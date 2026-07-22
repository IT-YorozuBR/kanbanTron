import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "session_token";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;

  const expected = Buffer.from(hash, "hex");
  const candidate = scryptSync(password, salt, SCRYPT_KEYLEN);
  // Lengths always match here (fixed keylen), but timingSafeEqual throws on
  // mismatched buffer lengths, so guard defensively before comparing.
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export type SessionUser = {
  id: string;
  email: string;
  role: string;
  sectorId: string | null;
  sectorName: string | null;
};

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({ data: { token, userId, expiresAt } });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Tied to whether the deployment actually terminates TLS, not NODE_ENV:
    // this app is served over plain HTTP on port 3010 with no reverse proxy,
    // so a `Secure` cookie would be silently dropped by the browser, causing
    // an infinite login loop (login succeeds, cookie never gets stored).
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  cookieStore.delete(SESSION_COOKIE);
}

// The single source of truth for "who is making this request" — every
// Server Action and page must go through this (directly or via requireUser)
// rather than trusting anything the client sends.
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { sector: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    sectorId: session.user.sectorId,
    sectorName: session.user.sector?.name ?? null,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

// True when the user may read/write something that belongs to `sectorId`:
// admins can touch any sector, members only their own.
export function canAccessSector(user: SessionUser, sectorId: string): boolean {
  return user.role === "admin" || user.sectorId === sectorId;
}
