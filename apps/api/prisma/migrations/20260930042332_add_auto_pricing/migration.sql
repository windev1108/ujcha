-- CreateEnum
CREATE TYPE "PricingMode" AS ENUM ('auto', 'fixed');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "pricingMarkupPercent" DECIMAL(7,2);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "autoPrice" DECIMAL(12,2),
ADD COLUMN     "costPrice" DECIMAL(14,2),
ADD COLUMN     "pricingComputedAt" TIMESTAMP(3),
ADD COLUMN     "pricingMarkupPercent" DECIMAL(7,2),
ADD COLUMN     "pricingMode" "PricingMode" NOT NULL DEFAULT 'auto',
ADD COLUMN     "pricingSnapshotJson" JSONB;

-- CreateTable
CREATE TABLE "PricingConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultMarkupPercent" DECIMAL(7,2),
    "roundingStep" INTEGER NOT NULL DEFAULT 1000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingConfig_pkey" PRIMARY KEY ("id")
);
