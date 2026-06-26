-- AlterTable
ALTER TABLE "DeliveryPlatform" ADD COLUMN     "displayMode" TEXT NOT NULL DEFAULT 'logo_and_text',
ADD COLUMN     "logoSize" TEXT NOT NULL DEFAULT 'md';
