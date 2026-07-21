import type { BoardData } from "@/lib/actions";

export type ColumnWithCards = BoardData["columns"][number];
export type CardWithAttachments = ColumnWithCards["cards"][number];
export type AttachmentData = CardWithAttachments["attachments"][number];
