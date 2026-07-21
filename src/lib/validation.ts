import { z } from "zod";

const cuid = z.string().min(1).max(64);
const accent = z.enum(["blue", "lime", "tangerine", "grape", "berry"]);

export const createBoardSchema = z.object({
  title: z.string().trim().min(1, "Informe um titulo").max(60),
  accent,
});

export const updateBoardSchema = z.object({
  boardId: cuid,
  title: z.string().trim().min(1, "Informe um titulo").max(60).optional(),
  accent: accent.optional(),
});

export const deleteBoardSchema = z.object({
  boardId: cuid,
});

export const createColumnSchema = z.object({
  boardId: cuid,
  title: z.string().trim().min(1, "Informe um titulo").max(60),
});

export const renameColumnSchema = z.object({
  columnId: cuid,
  title: z.string().trim().min(1, "Informe um titulo").max(60),
});

export const deleteColumnSchema = z.object({
  columnId: cuid,
});

export const reorderColumnsSchema = z.object({
  boardId: cuid,
  orderedColumnIds: z.array(cuid).min(1).max(200),
});

export const createCardSchema = z.object({
  columnId: cuid,
  title: z.string().trim().min(1, "Informe um titulo").max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const updateCardSchema = z.object({
  cardId: cuid,
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const deleteCardSchema = z.object({
  cardId: cuid,
});

export const moveCardSchema = z.object({
  cardId: cuid,
  toColumnId: cuid,
  orderedCardIds: z.array(cuid).min(1).max(2000),
});

export const deleteAttachmentSchema = z.object({
  attachmentId: cuid,
});

export const FIELD_TYPES = ["short_text", "long_text", "attachment", "single_choice", "multi_choice"] as const;
const fieldType = z.enum(FIELD_TYPES);
const fieldOption = z.string().trim().min(1).max(60);

export const createFieldDefinitionSchema = z
  .object({
    columnId: cuid,
    label: z.string().trim().min(1, "Informe um nome").max(60),
    type: fieldType,
    options: z.array(fieldOption).max(30).optional(),
  })
  .refine(
    (data) => (data.type === "single_choice" || data.type === "multi_choice" ? (data.options?.length ?? 0) >= 2 : true),
    { message: "Adicione ao menos 2 opcoes", path: ["options"] },
  );

export const updateFieldDefinitionSchema = z.object({
  fieldDefinitionId: cuid,
  label: z.string().trim().min(1, "Informe um nome").max(60).optional(),
  options: z.array(fieldOption).max(30).optional(),
});

export const deleteFieldDefinitionSchema = z.object({
  fieldDefinitionId: cuid,
});

export const reorderFieldDefinitionsSchema = z.object({
  columnId: cuid,
  orderedFieldDefinitionIds: z.array(cuid).min(1).max(100),
});

export const setTextFieldValueSchema = z.object({
  cardId: cuid,
  fieldDefinitionId: cuid,
  value: z.string().trim().max(2000),
});

export const setChoiceFieldValueSchema = z.object({
  cardId: cuid,
  fieldDefinitionId: cuid,
  selected: z.array(fieldOption).max(30),
});

export const deleteFieldAttachmentSchema = z.object({
  cardId: cuid,
  fieldDefinitionId: cuid,
});

// Media upload constraints
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_VIDEO_BYTES = 80 * 1024 * 1024; // 80MB
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;
export const ALLOWED_VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
