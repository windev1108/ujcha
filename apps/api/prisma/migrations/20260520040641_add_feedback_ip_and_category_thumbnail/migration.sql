-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "thumbnail" TEXT;

-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN     "ip" TEXT;

-- CreateIndex
CREATE INDEX "Feedback_ip_createdAt_idx" ON "Feedback"("ip", "createdAt");
