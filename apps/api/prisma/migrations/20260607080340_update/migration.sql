/*
  Warnings:

  - Added the required column `updatedAt` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Notification_userId_createdAt_idx";

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Notification_userId_updatedAt_idx" ON "Notification"("userId", "updatedAt");
