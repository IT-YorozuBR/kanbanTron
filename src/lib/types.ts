import type { BoardData, BoardSummary } from "@/lib/actions";

export type { BoardData, BoardSummary };
export type ColumnWithCards = BoardData["columns"][number];
export type CardWithAttachments = ColumnWithCards["cards"][number];
export type AttachmentData = CardWithAttachments["attachments"][number];
