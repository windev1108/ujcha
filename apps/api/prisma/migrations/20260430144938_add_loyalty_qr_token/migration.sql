-- AlterTable: add loyaltyQrToken for bill QR loyalty scan
ALTER TABLE "Order" ADD COLUMN "loyaltyQrToken" UUID NOT NULL DEFAULT gen_random_uuid();

-- CreateIndex
CREATE UNIQUE INDEX "Order_loyaltyQrToken_key" ON "Order"("loyaltyQrToken");
