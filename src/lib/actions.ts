"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { deleteMediaFile, storeMediaAttachment, MediaValidationError } from "@/lib/media-storage";
import { encodeOptions } from "@/lib/field-options";
import {
  createBoardSchema,
  createCardSchema,
  createColumnSchema,
  createFieldDefinitionSchema,
  deleteBoardSchema,
  deleteCardSchema,
  deleteColumnSchema,
  deleteFieldAttachmentSchema,
  deleteFieldDefinitionSchema,
  moveCardSchema,
  renameColumnSchema,
  reorderColumnsSchema,
  reorderFieldDefinitionsSchema,
  setChoiceFieldValueSchema,
  setTextFieldValueSchema,
  updateBoardSchema,
  updateCardSchema,
  updateFieldDefinitionSchema,
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
          fieldDefinitions: { orderBy: { order: "asc" } },
          cards: {
            orderBy: { order: "asc" },
            include: {
              attachments: { orderBy: { createdAt: "asc" } },
              fieldValues: {
                include: { attachments: { orderBy: { createdAt: "asc" } }, fieldDefinition: true },
              },
            },
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
    include: {
      cards: { include: { attachments: true } },
      fieldDefinitions: { include: { values: { include: { attachments: true } } } },
    },
  });
  if (!column) return fail("Fase nao encontrada.");

  // Cards in this column cascade-delete along with it, taking their
  // attachments with them. This column's field definitions can also hold
  // values (kept as history) on cards that have since moved to OTHER
  // columns; those cascade too (Column -> FieldDefinition -> FieldValue ->
  // Attachment), but the filenames must be collected before the delete.
  const filenames = new Set([
    ...column.cards.flatMap((c) => c.attachments.map((a) => a.filename)),
    ...column.fieldDefinitions.flatMap((f) => f.values.flatMap((v) => v.attachments.map((a) => a.filename))),
  ]);

  await prisma.column.delete({ where: { id: parsed.data.columnId } });
  await Promise.all([...filenames].map(deleteMediaFile));

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

export async function createFieldDefinition(input: unknown): Promise<ActionResult<{ id: string }>> {
  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 30).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = createFieldDefinitionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const column = await prisma.column.findUnique({ where: { id: parsed.data.columnId } });
  if (!column) return fail("Fase nao encontrada.");

  const last = await prisma.fieldDefinition.findFirst({
    where: { columnId: parsed.data.columnId },
    orderBy: { order: "desc" },
  });

  const isChoice = parsed.data.type === "single_choice" || parsed.data.type === "multi_choice";

  const field = await prisma.fieldDefinition.create({
    data: {
      columnId: parsed.data.columnId,
      label: parsed.data.label,
      type: parsed.data.type,
      options: isChoice ? encodeOptions(parsed.data.options ?? []) : null,
      order: (last?.order ?? -1) + 1,
    },
  });

  revalidatePath(`/boards/${column.boardId}`);
  return { ok: true, data: { id: field.id } };
}

export async function updateFieldDefinition(input: unknown): Promise<ActionResult> {
  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 60).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = updateFieldDefinitionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const field = await prisma.fieldDefinition.findUnique({
    where: { id: parsed.data.fieldDefinitionId },
    include: { column: true },
  });
  if (!field) return fail("Campo nao encontrado.");

  const isChoice = field.type === "single_choice" || field.type === "multi_choice";

  await prisma.fieldDefinition.update({
    where: { id: parsed.data.fieldDefinitionId },
    data: {
      ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
      ...(isChoice && parsed.data.options !== undefined ? { options: encodeOptions(parsed.data.options) } : {}),
    },
  });

  revalidatePath(`/boards/${field.column.boardId}`);
  return { ok: true, data: undefined };
}

export async function deleteFieldDefinition(input: unknown): Promise<ActionResult> {
  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 30).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = deleteFieldDefinitionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const field = await prisma.fieldDefinition.findUnique({
    where: { id: parsed.data.fieldDefinitionId },
    include: { column: true, values: { include: { attachments: true } } },
  });
  if (!field) return fail("Campo nao encontrado.");

  // FieldValue and Attachment rows cascade-delete along with the field
  // definition; filenames must be collected before the delete happens.
  const filenames = field.values.flatMap((v) => v.attachments.map((a) => a.filename));
  await prisma.fieldDefinition.delete({ where: { id: parsed.data.fieldDefinitionId } });
  await Promise.all(filenames.map(deleteMediaFile));

  revalidatePath(`/boards/${field.column.boardId}`);
  return { ok: true, data: undefined };
}

export async function reorderFieldDefinitions(input: unknown): Promise<ActionResult> {
  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 60).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = reorderFieldDefinitionsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const { columnId, orderedFieldDefinitionIds } = parsed.data;

  const column = await prisma.column.findUnique({ where: { id: columnId } });
  if (!column) return fail("Fase nao encontrada.");

  await prisma.$transaction(
    orderedFieldDefinitionIds.map((id, index) =>
      prisma.fieldDefinition.update({ where: { id, columnId }, data: { order: index } }),
    ),
  );

  revalidatePath(`/boards/${column.boardId}`);
  return { ok: true, data: undefined };
}

export async function setTextFieldValue(input: unknown): Promise<ActionResult> {
  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 120).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = setTextFieldValueSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const field = await prisma.fieldDefinition.findUnique({ where: { id: parsed.data.fieldDefinitionId } });
  if (!field) return fail("Campo nao encontrado.");
  if (field.type !== "short_text" && field.type !== "long_text") return fail("Tipo de campo invalido.");

  await prisma.fieldValue.upsert({
    where: {
      cardId_fieldDefinitionId: { cardId: parsed.data.cardId, fieldDefinitionId: parsed.data.fieldDefinitionId },
    },
    create: {
      cardId: parsed.data.cardId,
      fieldDefinitionId: parsed.data.fieldDefinitionId,
      textValue: parsed.data.value,
    },
    update: { textValue: parsed.data.value },
  });

  return { ok: true, data: undefined };
}

export async function setChoiceFieldValue(input: unknown): Promise<ActionResult> {
  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 120).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = setChoiceFieldValueSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const field = await prisma.fieldDefinition.findUnique({ where: { id: parsed.data.fieldDefinitionId } });
  if (!field) return fail("Campo nao encontrado.");
  if (field.type !== "single_choice" && field.type !== "multi_choice") return fail("Tipo de campo invalido.");

  const validOptions = new Set(JSON.parse(field.options ?? "[]"));
  const selected = parsed.data.selected.filter((opt) => validOptions.has(opt));
  const bounded = field.type === "single_choice" ? selected.slice(0, 1) : selected;

  await prisma.fieldValue.upsert({
    where: {
      cardId_fieldDefinitionId: { cardId: parsed.data.cardId, fieldDefinitionId: parsed.data.fieldDefinitionId },
    },
    create: {
      cardId: parsed.data.cardId,
      fieldDefinitionId: parsed.data.fieldDefinitionId,
      choiceValue: encodeOptions(bounded),
    },
    update: { choiceValue: encodeOptions(bounded) },
  });

  return { ok: true, data: undefined };
}

export async function uploadFieldAttachment(
  formData: FormData,
): Promise<ActionResult<{ id: string; filename: string }>> {
  const key = await clientKey();
  if (!rateLimit(`upload:${key}`, 20).ok) return fail("Muitos uploads seguidos. Aguarde um instante.");

  const cardId = formData.get("cardId");
  const fieldDefinitionId = formData.get("fieldDefinitionId");
  const file = formData.get("file");

  if (typeof cardId !== "string" || cardId.length === 0) return fail("Card invalido.");
  if (typeof fieldDefinitionId !== "string" || fieldDefinitionId.length === 0) return fail("Campo invalido.");
  if (!(file instanceof File)) return fail("Nenhum arquivo enviado.");

  const [card, field] = await Promise.all([
    prisma.card.findUnique({ where: { id: cardId } }),
    prisma.fieldDefinition.findUnique({ where: { id: fieldDefinitionId } }),
  ]);
  if (!card) return fail("Card nao encontrado.");
  if (!field || field.type !== "attachment") return fail("Campo invalido.");

  try {
    const stored = await storeMediaAttachment(file);

    const fieldValue = await prisma.fieldValue.upsert({
      where: { cardId_fieldDefinitionId: { cardId, fieldDefinitionId } },
      create: { cardId, fieldDefinitionId },
      update: {},
    });

    const attachment = await prisma.attachment.create({
      data: {
        cardId,
        fieldValueId: fieldValue.id,
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

export async function deleteFieldAttachment(input: unknown): Promise<ActionResult> {
  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 60).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = deleteFieldAttachmentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const attachment = await prisma.attachment.findUnique({ where: { id: parsed.data.attachmentId } });
  if (!attachment) return fail("Anexo nao encontrado.");

  await prisma.attachment.delete({ where: { id: parsed.data.attachmentId } });
  await deleteMediaFile(attachment.filename);

  return { ok: true, data: undefined };
}

export async function createCard(input: unknown): Promise<ActionResult<{ id: string; title: string }>> {
  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 60).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = createCardSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const last = await prisma.card.findFirst({
    where: { columnId: parsed.data.columnId },
    orderBy: { order: "desc" },
  });
  const nextOrder = (last?.order ?? -1) + 1;

  const card = await prisma.card.create({
    data: {
      columnId: parsed.data.columnId,
      title: parsed.data.title?.trim() || `Card ${nextOrder + 1}`,
      order: nextOrder,
    },
  });

  return { ok: true, data: { id: card.id, title: card.title } };
}

export async function updateCard(input: unknown): Promise<ActionResult> {
  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 60).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = updateCardSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  await prisma.card.update({
    where: { id: parsed.data.cardId },
    data: { title: parsed.data.title },
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

export type BoardData = NonNullable<Awaited<ReturnType<typeof getBoard>>>;
export type BoardSummary = Awaited<ReturnType<typeof listBoards>>[number];
