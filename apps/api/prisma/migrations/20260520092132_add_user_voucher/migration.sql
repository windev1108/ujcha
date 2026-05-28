-- CreateEnum
CREATE TYPE "UserVoucherSource" AS ENUM ('welcome', 'referral', 'admin_grant');

-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN     "isWelcome" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "UserVoucher" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "voucherId" UUID NOT NULL,
    "source" "UserVoucherSource" NOT NULL DEFAULT 'admin_grant',
    "usedAt" TIMESTAMP(3),
    "usedOrderId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserVoucher_userId_idx" ON "UserVoucher"("userId");

-- CreateIndex
CREATE INDEX "UserVoucher_voucherId_idx" ON "UserVoucher"("voucherId");

-- CreateIndex
CREATE INDEX "UserVoucher_userId_usedAt_idx" ON "UserVoucher"("userId", "usedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserVoucher_userId_voucherId_key" ON "UserVoucher"("userId", "voucherId");

-- CreateIndex
CREATE INDEX "Voucher_isWelcome_idx" ON "Voucher"("isWelcome");

-- AddForeignKey
ALTER TABLE "UserVoucher" ADD CONSTRAINT "UserVoucher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVoucher" ADD CONSTRAINT "UserVoucher_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
