/*
  Warnings:

  - A unique constraint covering the columns `[adminId]` on the table `Shipper` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `paidAt` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('cash', 'bank_transfer');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paidAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "paymentType" "PaymentType" NOT NULL DEFAULT 'cash',
ADD COLUMN     "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "vatConfigId" UUID,
ADD COLUMN     "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Shipper" ADD COLUMN     "adminId" UUID;

-- CreateTable
CREATE TABLE "VatConfig" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "vatPercent" DECIMAL(5,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VatConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "content" TEXT NOT NULL,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VatConfig_isActive_idx" ON "VatConfig"("isActive");

-- CreateIndex
CREATE INDEX "VatConfig_effectiveFrom_idx" ON "VatConfig"("effectiveFrom");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Shipper_adminId_key" ON "Shipper"("adminId");

-- AddForeignKey
ALTER TABLE "Shipper" ADD CONSTRAINT "Shipper_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_vatConfigId_fkey" FOREIGN KEY ("vatConfigId") REFERENCES "VatConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
