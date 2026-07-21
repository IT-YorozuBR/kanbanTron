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
