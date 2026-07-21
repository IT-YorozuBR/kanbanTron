/*
  Warnings:

  - Added the required column `sectorId` to the `Board` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Sector" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "sectorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Seed a default sector so existing boards (created before sectors existed)
-- have somewhere valid to attach to.
INSERT INTO "Sector" ("id", "name", "createdAt") VALUES ('default-sector-geral', 'Geral', CURRENT_TIMESTAMP);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Board" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "accent" TEXT NOT NULL DEFAULT 'blue',
    "sectorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Board_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Board" ("accent", "createdAt", "id", "title", "updatedAt", "sectorId") SELECT "accent", "createdAt", "id", "title", "updatedAt", 'default-sector-geral' FROM "Board";
DROP TABLE "Board";
ALTER TABLE "new_Board" RENAME TO "Board";
CREATE INDEX "Board_sectorId_idx" ON "Board"("sectorId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Sector_name_key" ON "Sector"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
