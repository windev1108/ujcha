-- AlterTable
ALTER TABLE "ShippingConfig" ADD COLUMN     "weatherSurchargeActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weatherSurchargeFee" INTEGER NOT NULL DEFAULT 0;
