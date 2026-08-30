-- CreateTable
CREATE TABLE "semesters" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "label" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "term" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "courses" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "semesterId" INTEGER NOT NULL,
    CONSTRAINT "courses_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "teachers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "petition_slots" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "teacherId" INTEGER NOT NULL,
    "semesterId" INTEGER NOT NULL,
    "slotNo" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "petition_slots_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "petition_slots_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "slot_options" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slotId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL,
    CONSTRAINT "slot_options_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "petition_slots" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "slot_options_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "semesters_label_key" ON "semesters"("label");

-- CreateIndex
CREATE UNIQUE INDEX "courses_code_key" ON "courses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_email_key" ON "teachers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "petition_slots_teacherId_semesterId_slotNo_key" ON "petition_slots"("teacherId", "semesterId", "slotNo");

-- CreateIndex
CREATE UNIQUE INDEX "slot_options_slotId_courseId_key" ON "slot_options"("slotId", "courseId");
