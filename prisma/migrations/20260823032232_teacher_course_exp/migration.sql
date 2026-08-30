-- CreateTable
CREATE TABLE "teacher_course_exp" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "teacherId" INTEGER NOT NULL,
    "courseCode" TEXT NOT NULL,
    "years" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "teacher_course_exp_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "teacher_course_exp_teacherId_idx" ON "teacher_course_exp"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_course_exp_teacherId_courseCode_key" ON "teacher_course_exp"("teacherId", "courseCode");
