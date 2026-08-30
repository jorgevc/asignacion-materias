/*
  Warnings:

  - You are about to drop the `petition_slots` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `slot_options` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "petition_slots";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "slot_options";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "petitions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "teacherId" INTEGER NOT NULL,
    "semesterId" INTEGER NOT NULL,
    "slotNo" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "petitions_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "petitions_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "petitions_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "petitions_teacherId_semesterId_slotNo_idx" ON "petitions"("teacherId", "semesterId", "slotNo");

-- CreateIndex
CREATE INDEX "petitions_semesterId_idx" ON "petitions"("semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "petitions_teacherId_semesterId_courseId_key" ON "petitions"("teacherId", "semesterId", "courseId");
