-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Board" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "accent" TEXT NOT NULL DEFAULT 'blue',
    "sectorId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Board_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Board_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Board" ("accent", "createdAt", "id", "sectorId", "title", "updatedAt") SELECT "accent", "createdAt", "id", "sectorId", "title", "updatedAt" FROM "Board";
DROP TABLE "Board";
ALTER TABLE "new_Board" RENAME TO "Board";
CREATE INDEX "Board_sectorId_idx" ON "Board"("sectorId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
