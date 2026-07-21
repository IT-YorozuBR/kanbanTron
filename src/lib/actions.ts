"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { deleteMediaFile, storeMediaAttachment, MediaValidationError } from "@/lib/media-storage";
import { encodeOptions } from "@/lib/field-options";
import { canAccessSector, getSessionUser, type SessionUser } from "@/lib/auth";
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

const NOT_AUTHENTICATED = "Sessao expirada. Faca login novamente.";
const NOT_AUTHORIZED = "Voce nao tem permissao para isso.";

async function requireSessionUser(): Promise<SessionUser | null> {
  return getSessionUser();
}

// Every board-scoped mutation resolves up to the owning board's sectorId
// and checks it against the caller's session before touching anything —
// this is what stops a member of one sector from reading or writing another
// sector's data by guessing/crafting ids, even though the UI never exposes
// them.
async function boardSectorId(boardId: string): Promise<string | null> {
  const board = await prisma.board.findUnique({ where: { id: boardId }, select: { sectorId: true } });
  return board?.sectorId ?? null;
}

async function columnSectorId(columnId: string): Promise<string | null> {
  const column = await prisma.column.findUnique({
    where: { id: columnId },
    select: { board: { select: { sectorId: true } } },
  });
  return column?.board.sectorId ?? null;
}

async function cardSectorId(cardId: string): Promise<string | null> {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { column: { select: { board: { select: { sectorId: true } } } } },
  });
  return card?.column.board.sectorId ?? null;
}

async function fieldDefinitionSectorId(fieldDefinitionId: string): Promise<string | null> {
  const field = await prisma.fieldDefinition.findUnique({
    where: { id: fieldDefinitionId },
    select: { column: { select: { board: { select: { sectorId: true } } } } },
  });
  return field?.column.board.sectorId ?? null;
}

async function attachmentSectorId(attachmentId: string): Promise<string | null> {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    select: { card: { select: { column: { select: { board: { select: { sectorId: true } } } } } } },
  });
  return attachment?.card.column.board.sectorId ?? null;
}

export async function listBoards() {
  const user = await requireSessionUser();
  if (!user) return [];

  const boards = await prisma.board.findMany({
    where: user.role === "admin" ? {} : { sectorId: user.sectorId ?? "" },
    orderBy: { createdAt: "desc" },
    include: {
      sector: { select: { name: true } },
      columns: { select: { _count: { select: { cards: true } } } },
    },
  });

  return boards.map((board) => ({
    id: board.id,
    title: board.title,
    accent: board.accent,
    sectorName: board.sector.name,
    createdById: board.createdById,
    createdAt: board.createdAt,
    columnCount: board.columns.length,
    cardCount: board.columns.reduce((sum, column) => sum + column._count.cards, 0),
  }));
}

export async function getBoard(boardId: string) {
  const user = await requireSessionUser();
  if (!user) return null;

  const sectorId = await boardSectorId(boardId);
  // A nonexistent board and one you're not allowed to see look identical to
  // the caller (both resolve to null -> the page shows a 404), so this
  // can't be used to probe which board ids exist in other sectors.
  if (!sectorId || !canAccessSector(user, sectorId)) return null;

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
  const user = await requireSessionUser();
  if (!user) return fail(NOT_AUTHENTICATED);

  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 30).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = createBoardSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  // Members always get their own sector regardless of what's in the
  // payload; only admins may target an arbitrary sector, and only one that
  // actually exists.
  let sectorId: string;
  if (user.role === "admin") {
    if (!parsed.data.sectorId) return fail("Selecione um setor.");
    const sector = await prisma.sector.findUnique({ where: { id: parsed.data.sectorId } });
    if (!sector) return fail("Setor nao encontrado.");
    sectorId = sector.id;
  } else {
    if (!user.sectorId) return fail(NOT_AUTHORIZED);
    sectorId = user.sectorId;
  }

  const board = await prisma.board.create({
    data: {
      title: parsed.data.title,
      accent: parsed.data.accent,
      sectorId,
      createdById: user.id,
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
  const user = await requireSessionUser();
  if (!user) return fail(NOT_AUTHENTICATED);

  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 60).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = updateBoardSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const { boardId, ...rest } = parsed.data;
  const sectorId = await boardSectorId(boardId);
  if (!sectorId || !canAccessSector(user, sectorId)) return fail(NOT_AUTHORIZED);

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
  const user = await requireSessionUser();
  if (!user) return fail(NOT_AUTHENTICATED);

  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 30).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = deleteBoardSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const board = await prisma.board.findUnique({
    where: { id: parsed.data.boardId },
    include: { columns: { include: { cards: { include: { attachments: true } } } } },
  });
  if (!board) return fail("Quadro nao encontrado.");
  // Deletion is intentionally narrower than the usual sector-wide access
  // check: only the board's own creator or an admin may delete it, even
  // though any sector member can view/edit it.
  if (user.role !== "admin" && board.createdById !== user.id) return fail(NOT_AUTHORIZED);

  const filenames = board.columns.flatMap((column) =>
    column.cards.flatMap((card) => card.attachments.map((a) => a.filename)),
  );
  await prisma.board.delete({ where: { id: parsed.data.boardId } });
  await Promise.all(filenames.map(deleteMediaFile));

  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function createColumn(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireSessionUser();
  if (!user) return fail(NOT_AUTHENTICATED);

  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 60).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = createColumnSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const sectorId = await boardSectorId(parsed.data.boardId);
  if (!sectorId || !canAccessSector(user, sectorId)) return fail(NOT_AUTHORIZED);

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
  const user = await requireSessionUser();
  if (!user) return fail(NOT_AUTHENTICATED);

  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 60).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = renameColumnSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const sectorId = await columnSectorId(parsed.data.columnId);
  if (!sectorId || !canAccessSector(user, sectorId)) return fail(NOT_AUTHORIZED);

  await prisma.column.update({
    where: { id: parsed.data.columnId },
    data: { title: parsed.data.title },
  });

  return { ok: true, data: undefined };
}

export async function deleteColumn(input: unknown): Promise<ActionResult> {
  const user = await requireSessionUser();
  if (!user) return fail(NOT_AUTHENTICATED);

  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 60).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = deleteColumnSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const column = await prisma.column.findUnique({
    where: { id: parsed.data.columnId },
    include: {
      board: { select: { sectorId: true } },
      cards: { include: { attachments: true } },
      fieldDefinitions: { include: { values: { include: { attachments: true } } } },
    },
  });
  if (!column) return fail("Fase nao encontrada.");
  if (!canAccessSector(user, column.board.sectorId)) return fail(NOT_AUTHORIZED);

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
  const user = await requireSessionUser();
  if (!user) return fail(NOT_AUTHENTICATED);

  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 120).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = reorderColumnsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const { boardId, orderedColumnIds } = parsed.data;

  const sectorId = await boardSectorId(boardId);
  if (!sectorId || !canAccessSector(user, sectorId)) return fail(NOT_AUTHORIZED);

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
  const user = await requireSessionUser();
  if (!user) return fail(NOT_AUTHENTICATED);

  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 30).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = createFieldDefinitionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const column = await prisma.column.findUnique({ where: { id: parsed.data.columnId } });
  if (!column) return fail("Fase nao encontrada.");
  const columnSector = await boardSectorId(column.boardId);
  if (!columnSector || !canAccessSector(user, columnSector)) return fail(NOT_AUTHORIZED);

  const last = await prisma.fieldDefinition.findFirst({
    where: { columnId: parsed.data.columnId },
    orderBy: { order: "desc" },
  });

  const isChoice = parsed.data.type === "single_choice" || parsed.data.type === "multi_choice";
  const isTitleField = parsed.data.isTitleField === true;

  const field = await prisma.$transaction(async (tx) => {
    if (isTitleField) {
      await tx.fieldDefinition.updateMany({
        where: { columnId: parsed.data.columnId },
        data: { isTitleField: false },
      });
    }
    return tx.fieldDefinition.create({
      data: {
        columnId: parsed.data.columnId,
        label: parsed.data.label,
        type: parsed.data.type,
        options: isChoice ? encodeOptions(parsed.data.options ?? []) : null,
        order: (last?.order ?? -1) + 1,
        isTitleField,
      },
    });
  });

  revalidatePath(`/boards/${column.boardId}`);
  return { ok: true, data: { id: field.id } };
}

export async function updateFieldDefinition(input: unknown): Promise<ActionResult> {
  const user = await requireSessionUser();
  if (!user) return fail(NOT_AUTHENTICATED);

  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 60).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = updateFieldDefinitionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const field = await prisma.fieldDefinition.findUnique({
    where: { id: parsed.data.fieldDefinitionId },
    include: { column: { include: { board: { select: { sectorId: true } } } } },
  });
  if (!field) return fail("Campo nao encontrado.");
  if (!canAccessSector(user, field.column.board.sectorId)) return fail(NOT_AUTHORIZED);

  const isChoice = field.type === "single_choice" || field.type === "multi_choice";
  const isTextType = field.type === "short_text" || field.type === "long_text";

  if (parsed.data.isTitleField === true && !isTextType) {
    return fail("Somente campos de texto podem ser o titulo do card.");
  }

  await prisma.$transaction(async (tx) => {
    if (parsed.data.isTitleField === true) {
      await tx.fieldDefinition.updateMany({
        where: { columnId: field.columnId, id: { not: field.id } },
        data: { isTitleField: false },
      });
    }
    await tx.fieldDefinition.update({
      where: { id: parsed.data.fieldDefinitionId },
      data: {
        ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
        ...(isChoice && parsed.data.options !== undefined ? { options: encodeOptions(parsed.data.options) } : {}),
        ...(parsed.data.isTitleField !== undefined ? { isTitleField: parsed.data.isTitleField } : {}),
      },
    });
  });

  revalidatePath(`/boards/${field.column.boardId}`);
  return { ok: true, data: undefined };
}

export async function deleteFieldDefinition(input: unknown): Promise<ActionResult> {
  const user = await requireSessionUser();
  if (!user) return fail(NOT_AUTHENTICATED);

  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 30).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = deleteFieldDefinitionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const field = await prisma.fieldDefinition.findUnique({
    where: { id: parsed.data.fieldDefinitionId },
    include: { column: { include: { board: { select: { sectorId: true } } } }, values: { include: { attachments: true } } },
  });
  if (!field) return fail("Campo nao encontrado.");
  if (!canAccessSector(user, field.column.board.sectorId)) return fail(NOT_AUTHORIZED);

  // FieldValue and Attachment rows cascade-delete along with the field
  // definition; filenames must be collected before the delete happens.
  const filenames = field.values.flatMap((v) => v.attachments.map((a) => a.filename));
  await prisma.fieldDefinition.delete({ where: { id: parsed.data.fieldDefinitionId } });
  await Promise.all(filenames.map(deleteMediaFile));

  revalidatePath(`/boards/${field.column.boardId}`);
  return { ok: true, data: undefined };
}

export async function reorderFieldDefinitions(input: unknown): Promise<ActionResult> {
  const user = await requireSessionUser();
  if (!user) return fail(NOT_AUTHENTICATED);

  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 60).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = reorderFieldDefinitionsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const { columnId, orderedFieldDefinitionIds } = parsed.data;

  const column = await prisma.column.findUnique({ where: { id: columnId } });
  if (!column) return fail("Fase nao encontrada.");
  const reorderSector = await boardSectorId(column.boardId);
  if (!reorderSector || !canAccessSector(user, reorderSector)) return fail(NOT_AUTHORIZED);

  await prisma.$transaction(
    orderedFieldDefinitionIds.map((id, index) =>
      prisma.fieldDefinition.update({ where: { id, columnId }, data: { order: index } }),
    ),
  );

  revalidatePath(`/boards/${column.boardId}`);
  return { ok: true, data: undefined };
}

export async function setTextFieldValue(input: unknown): Promise<ActionResult<{ title: string | null }>> {
  const user = await requireSessionUser();
  if (!user) return fail(NOT_AUTHENTICATED);

  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 120).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = setTextFieldValueSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const field = await prisma.fieldDefinition.findUnique({ where: { id: parsed.data.fieldDefinitionId } });
  if (!field) return fail("Campo nao encontrado.");
  if (field.type !== "short_text" && field.type !== "long_text") return fail("Tipo de campo invalido.");

  const [fieldSector, cardSector] = await Promise.all([
    fieldDefinitionSectorId(parsed.data.fieldDefinitionId),
    cardSectorId(parsed.data.cardId),
  ]);
  if (!fieldSector || !cardSector || fieldSector !== cardSector || !canAccessSector(user, fieldSector)) {
    return fail(NOT_AUTHORIZED);
  }

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

  // Fields marked as the title source write through to Card.title so the
  // name keeps showing even after the card leaves this column.
  let title: string | null = null;
  if (field.isTitleField) {
    const trimmed = parsed.data.value.trim().slice(0, 120);
    if (trimmed) {
      const updated = await prisma.card.update({ where: { id: parsed.data.cardId }, data: { title: trimmed } });
      title = updated.title;
    }
  }

  return { ok: true, data: { title } };
}

export async function setChoiceFieldValue(input: unknown): Promise<ActionResult> {
  const user = await requireSessionUser();
  if (!user) return fail(NOT_AUTHENTICATED);

  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 120).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = setChoiceFieldValueSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const field = await prisma.fieldDefinition.findUnique({ where: { id: parsed.data.fieldDefinitionId } });
  if (!field) return fail("Campo nao encontrado.");
  if (field.type !== "single_choice" && field.type !== "multi_choice") return fail("Tipo de campo invalido.");

  const [fieldSector, cardSector] = await Promise.all([
    fieldDefinitionSectorId(parsed.data.fieldDefinitionId),
    cardSectorId(parsed.data.cardId),
  ]);
  if (!fieldSector || !cardSector || fieldSector !== cardSector || !canAccessSector(user, fieldSector)) {
    return fail(NOT_AUTHORIZED);
  }

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
  const user = await requireSessionUser();
  if (!user) return fail(NOT_AUTHENTICATED);

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

  const [fieldSector, cardSector] = await Promise.all([
    fieldDefinitionSectorId(fieldDefinitionId),
    cardSectorId(cardId),
  ]);
  if (!fieldSector || !cardSector || fieldSector !== cardSector || !canAccessSector(user, fieldSector)) {
    return fail(NOT_AUTHORIZED);
  }

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
  const user = await requireSessionUser();
  if (!user) return fail(NOT_AUTHENTICATED);

  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 60).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = deleteFieldAttachmentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const attachment = await prisma.attachment.findUnique({ where: { id: parsed.data.attachmentId } });
  if (!attachment) return fail("Anexo nao encontrado.");

  const sectorId = await attachmentSectorId(parsed.data.attachmentId);
  if (!sectorId || !canAccessSector(user, sectorId)) return fail(NOT_AUTHORIZED);

  await prisma.attachment.delete({ where: { id: parsed.data.attachmentId } });
  await deleteMediaFile(attachment.filename);

  return { ok: true, data: undefined };
}

export async function createCard(input: unknown): Promise<ActionResult<{ id: string; title: string }>> {
  const user = await requireSessionUser();
  if (!user) return fail(NOT_AUTHENTICATED);

  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 60).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = createCardSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const sectorId = await columnSectorId(parsed.data.columnId);
  if (!sectorId || !canAccessSector(user, sectorId)) return fail(NOT_AUTHORIZED);

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
  const user = await requireSessionUser();
  if (!user) return fail(NOT_AUTHENTICATED);

  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 60).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = updateCardSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const sectorId = await cardSectorId(parsed.data.cardId);
  if (!sectorId || !canAccessSector(user, sectorId)) return fail(NOT_AUTHORIZED);

  await prisma.card.update({
    where: { id: parsed.data.cardId },
    data: { title: parsed.data.title },
  });

  return { ok: true, data: undefined };
}

export async function deleteCard(input: unknown): Promise<ActionResult> {
  const user = await requireSessionUser();
  if (!user) return fail(NOT_AUTHENTICATED);

  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 60).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = deleteCardSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const card = await prisma.card.findUnique({
    where: { id: parsed.data.cardId },
    include: { attachments: true, column: { select: { board: { select: { sectorId: true } } } } },
  });
  if (!card) return fail("Card nao encontrado.");
  if (!canAccessSector(user, card.column.board.sectorId)) return fail(NOT_AUTHORIZED);

  await prisma.card.delete({ where: { id: parsed.data.cardId } });
  await Promise.all(card.attachments.map((a) => deleteMediaFile(a.filename)));

  return { ok: true, data: undefined };
}

export async function moveCard(input: unknown): Promise<ActionResult> {
  const user = await requireSessionUser();
  if (!user) return fail(NOT_AUTHENTICATED);

  const key = await clientKey();
  if (!rateLimit(`mutate:${key}`, 180).ok) return fail("Muitas acoes seguidas. Aguarde um instante.");

  const parsed = moveCardSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const { cardId, toColumnId, orderedCardIds } = parsed.data;

  const [sourceSector, destSector] = await Promise.all([cardSectorId(cardId), columnSectorId(toColumnId)]);
  if (!sourceSector || !destSector || sourceSector !== destSector || !canAccessSector(user, sourceSector)) {
    return fail(NOT_AUTHORIZED);
  }

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
