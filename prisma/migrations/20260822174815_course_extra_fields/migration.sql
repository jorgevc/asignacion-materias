-- DropIndex
DROP INDEX "courses_code_key";

-- AlterTable
ALTER TABLE "courses" ADD COLUMN "cupo" INTEGER;
ALTER TABLE "courses" ADD COLUMN "dias" TEXT;
ALTER TABLE "courses" ADD COLUMN "horario" TEXT;
ALTER TABLE "courses" ADD COLUMN "ubicacion" TEXT;

-- CreateIndex
CREATE INDEX "courses_semesterId_code_idx" ON "courses"("semesterId", "code");

-- CreateIndex
CREATE INDEX "courses_semesterId_idx" ON "courses"("semesterId");
