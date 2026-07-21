-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FieldDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "columnId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" TEXT,
    "isTitleField" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FieldDefinition_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "Column" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FieldDefinition" ("columnId", "createdAt", "id", "label", "options", "order", "type", "updatedAt") SELECT "columnId", "createdAt", "id", "label", "options", "order", "type", "updatedAt" FROM "FieldDefinition";
DROP TABLE "FieldDefinition";
ALTER TABLE "new_FieldDefinition" RENAME TO "FieldDefinition";
CREATE INDEX "FieldDefinition_columnId_order_idx" ON "FieldDefinition"("columnId", "order");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
