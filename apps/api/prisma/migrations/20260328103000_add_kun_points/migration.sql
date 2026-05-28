-- CreateEnum
CREATE TYPE "PointTransactionType" AS ENUM ('earn', 'spend', 'expire');

-- CreateEnum
CREATE TYPE "PointSource" AS ENUM ('order', 'referral', 'admin', 'promotion');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "pointBalance" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PointTransaction" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "PointTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "source" "PointSource" NOT NULL,
    "referenceId" UUID,
    "expiresAt" TIMESTAMP(3),
    "remainingAmount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointTransaction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "PointTransaction_userId_createdAt_idx" ON "PointTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PointTransaction_type_expiresAt_idx" ON "PointTransaction"("type", "expiresAt");

-- Check
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_amount_positive" CHECK ("amount" > 0);
