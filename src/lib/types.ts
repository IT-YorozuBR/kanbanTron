import type { BoardData, BoardSummary } from "@/lib/actions";
import type { FIELD_TYPES } from "@/lib/validation";

export type { BoardData, BoardSummary };
export type ColumnWithCards = BoardData["columns"][number];
export type CardWithAttachments = ColumnWithCards["cards"][number];
export type AttachmentData = CardWithAttachments["attachments"][number];
export type FieldDefinitionData = ColumnWithCards["fieldDefinitions"][number];
export type FieldValueData = CardWithAttachments["fieldValues"][number];
export type FieldType = (typeof FIELD_TYPES)[number];
