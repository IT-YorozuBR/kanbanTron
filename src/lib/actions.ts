"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { deleteMediaFile, storeMediaAttachment, MediaValidationError } from "@/lib/media-storage";
import {
  createBoardSchema,
  createCardSchema,
  createColumnSchema,
  deleteAttachmentSchema,
  deleteBoardSchema,
  deleteCardSchema,
  deleteColumnSchema,
  moveCardSchema,
  renameColumnSchema,
  reorderColumnsSchema,
  updateBoardSchema,
  updateCardSchema,
} from "@/lib/validation";

type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function clientKey() {
  const h = await headers();
  return h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "local";
}

function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

export async function listBoards() {
  const boards = await prisma.board.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      columns: { select: { _count: { select: { cards: true } } } },
    },
  });

  return boards.map((board) => ({
    id: board.id,
    title: board.title,
    accent: board.accent,
    createdAt: board.createdAt,
    columnCount: board.columns.length,
    cardCount: board.columns.reduce((sum, column) => sum + column._count.cards, 0),
  }));
}

export async function getBoard(boardId: string) {
  return prisma.board.findUnique({
    where: { id: boardId },
    include: {
      columns: {
        orderBy: { order: "asc" },
        include: {
          cards: {
            orderBy: { order: "asc" },
            include: { attachments: { orderBy: { createdAt: "asc" } } },
          },
        },
      },
    },
  });
}

export async function createBoard(input: unknown): Promise<ActionResult<{ id: string }>> {
  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 30).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = createBoardSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const board = await prisma.board.create({
    data: {
      title: parsed.data.title,
      accent: parsed.data.accent,
      columns: {
        create: [
          { title: "A fazer", order: 0 },
          { title: "Em andamento", order: 1 },
          { title: "Concluido", order: 2 },
        ],
      },
    },
  });

  revalidatePath("/");
  return { ok: true, data: { id: board.id } };
}

export async function updateBoard(input: unknown): Promise<ActionResult> {
  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 60).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = updateBoardSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const { boardId, ...rest } = parsed.data;
  await prisma.board.update({
    where: { id: boardId },
    data: {
      ...(rest.title !== undefined ? { title: rest.title } : {}),
      ...(rest.accent !== undefined ? { accent: rest.accent } : {}),
    },
  });

  revalidatePath("/");
  revalidatePath(`/boards/${boardId}`);
  return { ok: true, data: undefined };
}

export async function deleteBoard(input: unknown): Promise<ActionResult> {
  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 30).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = deleteBoardSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const board = await prisma.board.findUnique({
    where: { id: parsed.data.boardId },
    include: { columns: { include: { cards: { include: { attachments: true } } } } },
  });
  if (!board) return fail("Quadro nao encontrado.");

  const filenames = board.columns.flatMap((column) =>
    column.cards.flatMap((card) => card.attachments.map((a) => a.filename)),
  );
  await prisma.board.delete({ where: { id: parsed.data.boardId } });
  await Promise.all(filenames.map(deleteMediaFile));

  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function createColumn(input: unknown): Promise<ActionResult<{ id: string }>> {
  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 60).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = createColumnSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const last = await prisma.column.findFirst({
    where: { boardId: parsed.data.boardId },
    orderBy: { order: "desc" },
  });

  const column = await prisma.column.create({
    data: {
      boardId: parsed.data.boardId,
      title: parsed.data.title,
      order: (last?.order ?? -1) + 1,
    },
  });

  revalidatePath(`/boards/${parsed.data.boardId}`);
  return { ok: true, data: { id: column.id } };
}

export async function renameColumn(input: unknown): Promise<ActionResult> {
  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 60).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = renameColumnSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  await prisma.column.update({
    where: { id: parsed.data.columnId },
    data: { title: parsed.data.title },
  });

  return { ok: true, data: undefined };
}

export async function deleteColumn(input: unknown): Promise<ActionResult> {
  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 60).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = deleteColumnSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const column = await prisma.column.findUnique({
    where: { id: parsed.data.columnId },
    include: { cards: { include: { attachments: true } } },
  });
  if (!column) return fail("Fase nao encontrada.");

  const filenames = column.cards.flatMap((c) => c.attachments.map((a) => a.filename));
  await prisma.column.delete({ where: { id: parsed.data.columnId } });
  await Promise.all(filenames.map(deleteMediaFile));

  return { ok: true, data: undefined };
}

export async function reorderColumns(input: unknown): Promise<ActionResult> {
  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 120).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = reorderColumnsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const { boardId, orderedColumnIds } = parsed.data;

  await prisma.$transaction(
    orderedColumnIds.map((id, index) =>
      prisma.column.update({
        where: { id, boardId },
        data: { order: index },
      }),
    ),
  );

  revalidatePath(`/boards/${boardId}`);
  return { ok: true, data: undefined };
}

export async function createCard(input: unknown): Promise<ActionResult<{ id: string }>> {
  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 60).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = createCardSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const last = await prisma.card.findFirst({
    where: { columnId: parsed.data.columnId },
    orderBy: { order: "desc" },
  });

  const card = await prisma.card.create({
    data: {
      columnId: parsed.data.columnId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      order: (last?.order ?? -1) + 1,
    },
  });

  return { ok: true, data: { id: card.id } };
}

export async function updateCard(input: unknown): Promise<ActionResult> {
  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 60).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = updateCardSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const { cardId, ...rest } = parsed.data;
  await prisma.card.update({
    where: { id: cardId },
    data: {
      ...(rest.title !== undefined ? { title: rest.title } : {}),
      ...(rest.description !== undefined ? { description: rest.description || null } : {}),
    },
  });

  return { ok: true, data: undefined };
}

export async function deleteCard(input: unknown): Promise<ActionResult> {
  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 60).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = deleteCardSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const card = await prisma.card.findUnique({
    where: { id: parsed.data.cardId },
    include: { attachments: true },
  });
  if (!card) return fail("Card nao encontrado.");

  await prisma.card.delete({ where: { id: parsed.data.cardId } });
  await Promise.all(card.attachments.map((a) => deleteMediaFile(a.filename)));

  return { ok: true, data: undefined };
}

export async function moveCard(input: unknown): Promise<ActionResult> {
  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 180).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = moveCardSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const { cardId, toColumnId, orderedCardIds } = parsed.data;

  await prisma.$transaction([
    prisma.card.update({ where: { id: cardId }, data: { columnId: toColumnId } }),
    ...orderedCardIds.map((id, index) =>
      prisma.card.update({ where: { id }, data: { order: index } }),
    ),
  ]);

  return { ok: true, data: undefined };
}

export async function uploadAttachment(formData: FormData): Promise<ActionResult<{ id: string; filename: string }>> {
  const key = await clientKey();
  if (!rateLimit(`upload:${key}`, 20).ok) return fail("Muitos uploads seguidos. Aguarde um instante.");

  const cardId = formData.get("cardId");
  const file = formData.get("file");

  if (typeof cardId !== "string" || cardId.length === 0) return fail("Card invalido.");
  if (!(file instanceof File)) return fail("Nenhum arquivo enviado.");

  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) return fail("Card nao encontrado.");

  try {
    const stored = await storeMediaAttachment(file);
    const attachment = await prisma.attachment.create({
      data: {
        cardId,
        filename: stored.filename,
        originalName: file.name.slice(0, 200),
        mimeType: stored.mimeType,
        size: stored.size,
        width: stored.width,
        height: stored.height,
      },
    });

    return { ok: true, data: { id: attachment.id, filename: attachment.filename } };
  } catch (error) {
    if (error instanceof MediaValidationError) return fail(error.message);
    return fail("Falha ao processar o arquivo.");
  }
}

export async function deleteAttachment(input: unknown): Promise<ActionResult> {
  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 60).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = deleteAttachmentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const attachment = await prisma.attachment.findUnique({ where: { id: parsed.data.attachmentId } });
  if (!attachment) return fail("Anexo nao encontrado.");

  await prisma.attachment.delete({ where: { id: parsed.data.attachmentId } });
  await deleteMediaFile(attachment.filename);

  return { ok: true, data: undefined };
}

export type BoardData = NonNullable<Awaited<ReturnType<typeof getBoard>>>;
export type BoardSummary = Awaited<ReturnType<typeof listBoards>>[number];
