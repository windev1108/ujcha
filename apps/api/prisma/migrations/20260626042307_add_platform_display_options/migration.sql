-- AlterTable
ALTER TABLE "DeliveryPlatform" ADD COLUMN "displayMode" TEXT NOT NULL DEFAULT 'logo_and_text';
ALTER TABLE "DeliveryPlatform" ADD COLUMN "logoWidth" INTEGER NOT NULL DEFAULT 28;
ALTER TABLE "DeliveryPlatform" ADD COLUMN "logoHeight" INTEGER NOT NULL DEFAULT 28;
ALTER TABLE "DeliveryPlatform" DROP COLUMN "logoSize";
