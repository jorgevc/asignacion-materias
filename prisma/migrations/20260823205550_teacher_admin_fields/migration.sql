-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_teachers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "employeeId" TEXT,
    "phone" TEXT,
    "affiliation" TEXT NOT NULL DEFAULT 'Interno',
    "note" TEXT,
    "expYears" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_teachers" ("createdAt", "email", "expYears", "id", "name") SELECT "createdAt", "email", "expYears", "id", "name" FROM "teachers";
DROP TABLE "teachers";
ALTER TABLE "new_teachers" RENAME TO "teachers";
CREATE UNIQUE INDEX "teachers_email_key" ON "teachers"("email");
CREATE UNIQUE INDEX "teachers_employeeId_key" ON "teachers"("employeeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
