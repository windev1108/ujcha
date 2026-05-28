-- AlterEnum
ALTER TYPE "PointSource" ADD VALUE 'voucher_redeem';

-- AlterEnum
ALTER TYPE "UserVoucherSource" ADD VALUE 'point_redeem';

-- CreateTable
CREATE TABLE "PointRewardCatalog" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pointCost" INTEGER NOT NULL,
    "voucherId" UUID NOT NULL,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointRewardCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PointRewardCatalog_isActive_idx" ON "PointRewardCatalog"("isActive");

-- CreateIndex
CREATE INDEX "PointRewardCatalog_sortOrder_idx" ON "PointRewardCatalog"("sortOrder");

-- AddForeignKey
ALTER TABLE "PointRewardCatalog" ADD CONSTRAINT "PointRewardCatalog_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
