-- AlterTable
ALTER TABLE "Table" ADD COLUMN     "area" TEXT NOT NULL DEFAULT 'Tầng 1';

-- CreateIndex
CREATE INDEX "Table_area_idx" ON "Table"("area");
