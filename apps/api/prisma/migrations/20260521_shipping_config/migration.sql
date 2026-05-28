-- Add shippingFee to Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingFee" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Create ShippingConfig singleton table
CREATE TABLE IF NOT EXISTS "ShippingConfig" (
  "id"            TEXT NOT NULL DEFAULT 'default',
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "baseFee"       INTEGER NOT NULL DEFAULT 15000,
  "baseKm"        DOUBLE PRECISION NOT NULL DEFAULT 2,
  "feePerKm"      INTEGER NOT NULL DEFAULT 5000,
  "maxDistanceKm" DOUBLE PRECISION NOT NULL DEFAULT 15,
  "freeThreshold" INTEGER NOT NULL DEFAULT 200000,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "ShippingConfig_pkey" PRIMARY KEY ("id")
);

-- Insert default record if not exists
INSERT INTO "ShippingConfig" ("id", "isActive", "baseFee", "baseKm", "feePerKm", "maxDistanceKm", "freeThreshold", "updatedAt")
VALUES ('default', true, 15000, 2, 5000, 15, 200000, NOW())
ON CONFLICT ("id") DO NOTHING;
