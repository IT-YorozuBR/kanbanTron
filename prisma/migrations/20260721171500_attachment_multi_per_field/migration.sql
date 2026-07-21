/*
  Warnings:

  - You are about to drop the column `attachmentId` on the `FieldValue` table. All the data in the column will be lost.
  - Added the optional column `fieldValueId` to the `Attachment` table.

  Existing links from FieldValue.attachmentId -> Attachment.id are preserved
  by copying them onto the new Attachment.fieldValueId column before the old
  column is dropped, so no attachment data is lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "cardId" TEXT NOT NULL,
    "fieldValueId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_fieldValueId_fkey" FOREIGN KEY ("fieldValueId") REFERENCES "FieldValue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Attachment" ("id", "filename", "originalName", "mimeType", "size", "width", "height", "cardId", "fieldValueId", "createdAt")
SELECT a."id", a."filename", a."originalName", a."mimeType", a."size", a."width", a."height", a."cardId", fv."id", a."createdAt"
FROM "Attachment" a
LEFT JOIN "FieldValue" fv ON fv."attachmentId" = a."id";
DROP TABLE "Attachment";
ALTER TABLE "new_Attachment" RENAME TO "Attachment";
CREATE INDEX "Attachment_cardId_idx" ON "Attachment"("cardId");
CREATE INDEX "Attachment_fieldValueId_idx" ON "Attachment"("fieldValueId");

CREATE TABLE "new_FieldValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "fieldDefinitionId" TEXT NOT NULL,
    "textValue" TEXT,
    "choiceValue" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FieldValue_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FieldValue_fieldDefinitionId_fkey" FOREIGN KEY ("fieldDefinitionId") REFERENCES "FieldDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FieldValue" ("id", "cardId", "fieldDefinitionId", "textValue", "choiceValue", "updatedAt")
SELECT "id", "cardId", "fieldDefinitionId", "textValue", "choiceValue", "updatedAt" FROM "FieldValue";
DROP TABLE "FieldValue";
ALTER TABLE "new_FieldValue" RENAME TO "FieldValue";
CREATE INDEX "FieldValue_cardId_idx" ON "FieldValue"("cardId");
CREATE UNIQUE INDEX "FieldValue_cardId_fieldDefinitionId_key" ON "FieldValue"("cardId", "fieldDefinitionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
