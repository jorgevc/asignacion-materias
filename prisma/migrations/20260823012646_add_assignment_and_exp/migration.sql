-- CreateTable
CREATE TABLE "assignments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "teacherId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "semesterId" INTEGER NOT NULL,
    "slotNo" INTEGER NOT NULL,
    "petitionId" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL,
    "puntaje" INTEGER NOT NULL,
    "detalle" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assignments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assignments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assignments_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assignments_petitionId_fkey" FOREIGN KEY ("petitionId") REFERENCES "petitions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_teachers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "expYears" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_teachers" ("createdAt", "email", "id", "name") SELECT "createdAt", "email", "id", "name" FROM "teachers";
DROP TABLE "teachers";
ALTER TABLE "new_teachers" RENAME TO "teachers";
CREATE UNIQUE INDEX "teachers_email_key" ON "teachers"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "assignments_courseId_key" ON "assignments"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "assignments_petitionId_key" ON "assignments"("petitionId");

-- CreateIndex
CREATE INDEX "assignments_semesterId_slotNo_idx" ON "assignments"("semesterId", "slotNo");

-- CreateIndex
CREATE INDEX "assignments_teacherId_semesterId_idx" ON "assignments"("teacherId", "semesterId");
