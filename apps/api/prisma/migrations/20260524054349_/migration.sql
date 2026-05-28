/*
  Warnings:

  - You are about to drop the column `refereeVoucherAmount` on the `ReferralProgramConfig` table. All the data in the column will be lost.
  - You are about to drop the column `refereeVoucherName` on the `ReferralProgramConfig` table. All the data in the column will be lost.
  - You are about to drop the column `referrerRewardPoints` on the `ReferralProgramConfig` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "GroupOrderStatus" AS ENUM ('collecting', 'locked', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "GroupPaymentMode" AS ENUM ('host_pays', 'split');

-- CreateEnum
CREATE TYPE "GroupParticipantPaymentStatus" AS ENUM ('pending', 'paid');

-- CreateEnum
CREATE TYPE "GroupParticipantPaymentType" AS ENUM ('cash', 'bank_transfer');

-- AlterTable
ALTER TABLE "ReferralProgramConfig" DROP COLUMN "refereeVoucherAmount",
DROP COLUMN "refereeVoucherName",
DROP COLUMN "referrerRewardPoints";

-- AlterTable
ALTER TABLE "ShippingConfig" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "GroupOrder" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "hostUserId" UUID NOT NULL,
    "status" "GroupOrderStatus" NOT NULL DEFAULT 'collecting',
    "paymentMode" "GroupPaymentMode" NOT NULL,
    "type" "OrderType" NOT NULL,
    "addressId" UUID,
    "tableId" UUID,
    "pickupTime" TIMESTAMP(3),
    "shippingFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "orderId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupOrderParticipant" (
    "id" UUID NOT NULL,
    "groupOrderId" UUID NOT NULL,
    "userId" UUID,
    "guestName" TEXT,
    "sessionToken" TEXT NOT NULL,
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "isReady" BOOLEAN NOT NULL DEFAULT false,
    "paymentStatus" "GroupParticipantPaymentStatus" NOT NULL DEFAULT 'pending',
    "paymentType" "GroupParticipantPaymentType",
    "paymentQrToken" TEXT,
    "paidAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupOrderParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupOrderParticipantItem" (
    "id" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "selectedOptions" JSONB NOT NULL DEFAULT '{}',
    "toppingsJson" JSONB NOT NULL DEFAULT '[]',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupOrderParticipantItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupOrderConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "discountTiersJson" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupOrderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupOrder_token_key" ON "GroupOrder"("token");

-- CreateIndex
CREATE UNIQUE INDEX "GroupOrder_orderId_key" ON "GroupOrder"("orderId");

-- CreateIndex
CREATE INDEX "GroupOrder_token_idx" ON "GroupOrder"("token");

-- CreateIndex
CREATE INDEX "GroupOrder_hostUserId_idx" ON "GroupOrder"("hostUserId");

-- CreateIndex
CREATE INDEX "GroupOrder_status_idx" ON "GroupOrder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GroupOrderParticipant_sessionToken_key" ON "GroupOrderParticipant"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "GroupOrderParticipant_paymentQrToken_key" ON "GroupOrderParticipant"("paymentQrToken");

-- CreateIndex
CREATE INDEX "GroupOrderParticipant_groupOrderId_idx" ON "GroupOrderParticipant"("groupOrderId");

-- CreateIndex
CREATE INDEX "GroupOrderParticipant_userId_idx" ON "GroupOrderParticipant"("userId");

-- CreateIndex
CREATE INDEX "GroupOrderParticipant_sessionToken_idx" ON "GroupOrderParticipant"("sessionToken");

-- CreateIndex
CREATE INDEX "GroupOrderParticipantItem_participantId_idx" ON "GroupOrderParticipantItem"("participantId");

-- AddForeignKey
ALTER TABLE "GroupOrder" ADD CONSTRAINT "GroupOrder_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupOrder" ADD CONSTRAINT "GroupOrder_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupOrder" ADD CONSTRAINT "GroupOrder_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupOrder" ADD CONSTRAINT "GroupOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupOrderParticipant" ADD CONSTRAINT "GroupOrderParticipant_groupOrderId_fkey" FOREIGN KEY ("groupOrderId") REFERENCES "GroupOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupOrderParticipant" ADD CONSTRAINT "GroupOrderParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupOrderParticipantItem" ADD CONSTRAINT "GroupOrderParticipantItem_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "GroupOrderParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupOrderParticipantItem" ADD CONSTRAINT "GroupOrderParticipantItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
