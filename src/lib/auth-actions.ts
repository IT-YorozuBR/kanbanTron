"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { createSession, destroySession, hashPassword, requireAdmin, requireUser, verifyPassword } from "@/lib/auth";
import {
  createSectorSchema,
  createUserForAnySectorSchema,
  createUserForOwnSectorSchema,
  loginSchema,
  setupAdminSchema,
} from "@/lib/auth-validation";

type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

async function clientKey() {
  const h = await headers();
  return h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "local";
}

// Only usable while the database has zero users — this is how the very
// first admin account gets created, since nothing else can authenticate
// yet. Re-checks the count right before the insert to close the race where
// two people load /setup at once.
export async function setupInitialAdmin(input: unknown): Promise<ActionResult> {
  const key = await clientKey();
  if (!rateLimit(`setup:${key}`, 5).ok) return fail("Muitas tentativas. Aguarde um instante.");

  const parsed = setupAdminSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const existingCount = await prisma.user.count();
  if (existingCount > 0) return fail("A configuracao inicial ja foi concluida.");

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      passwordHash: hashPassword(parsed.data.password),
      role: "admin",
    },
  });

  await createSession(user.id);
  redirect("/");
}

export async function login(input: unknown): Promise<ActionResult> {
  const key = await clientKey();
  if (!rateLimit(`login:${key}`, 10).ok) return fail("Muitas tentativas. Aguarde um instante.");

  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Always run verifyPassword (even against a dummy hash) so failed lookups
  // and failed password checks take the same amount of time, avoiding a
  // timing side-channel that reveals whether an email is registered.
  const matches = user
    ? verifyPassword(parsed.data.password, user.passwordHash)
    : verifyPassword(parsed.data.password, hashPassword("dummy-password-for-timing"));

  if (!user || !matches) return fail("Email ou senha invalidos.");

  await createSession(user.id);
  redirect("/");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function createSector(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 30).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = createSectorSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const existing = await prisma.sector.findUnique({ where: { name: parsed.data.name } });
  if (existing) return fail("Ja existe um setor com esse nome.");

  const sector = await prisma.sector.create({ data: { name: parsed.data.name } });
  return { ok: true, data: { id: sector.id } };
}

// Admin-only: creates a member account in any sector.
export async function createUserForAnySector(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 30).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = createUserForAnySectorSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const sector = await prisma.sector.findUnique({ where: { id: parsed.data.sectorId } });
  if (!sector) return fail("Setor nao encontrado.");

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return fail("Ja existe uma conta com esse email.");

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      passwordHash: hashPassword(parsed.data.password),
      role: "member",
      sectorId: parsed.data.sectorId,
    },
  });
  return { ok: true, data: { id: user.id } };
}

// Member-only: creates another account in the caller's own sector. The
// sector is always taken from the session, never from client input, so a
// member cannot plant an account in a sector they don't belong to.
export async function createUserForOwnSector(input: unknown): Promise<ActionResult<{ id: string }>> {
  const actor = await requireUser();
  if (actor.role !== "member" || !actor.sectorId) return fail("Apenas usuarios de um setor podem convidar.");

  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 30).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = createUserForOwnSectorSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return fail("Ja existe uma conta com esse email.");

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      passwordHash: hashPassword(parsed.data.password),
      role: "member",
      sectorId: actor.sectorId,
    },
  });
  return { ok: true, data: { id: user.id } };
}

export async function listSectors() {
  await requireAdmin();
  return prisma.sector.findMany({ orderBy: { name: "asc" } });
}

export async function listAllUsers() {
  await requireAdmin();
  return prisma.user.findMany({
    orderBy: { email: "asc" },
    include: { sector: true },
  });
}

export async function listOwnSectorUsers() {
  const actor = await requireUser();
  if (!actor.sectorId) return [];
  return prisma.user.findMany({
    where: { sectorId: actor.sectorId },
    orderBy: { email: "asc" },
  });
}

export async function hasAnyUser(): Promise<boolean> {
  const count = await prisma.user.count();
  return count > 0;
}
