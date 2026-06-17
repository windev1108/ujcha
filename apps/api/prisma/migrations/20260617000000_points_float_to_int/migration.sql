-- AlterTable: change point fields from DoublePrecision to Integer
-- Existing fractional values (from old 0.1-increment system) are floored to nearest integer.

ALTER TABLE "PointTransaction" ALTER COLUMN "amount" SET DATA TYPE INTEGER USING FLOOR("amount")::INTEGER;
ALTER TABLE "PointTransaction" ALTER COLUMN "remainingAmount" SET DATA TYPE INTEGER USING FLOOR("remainingAmount")::INTEGER;

ALTER TABLE "User" ALTER COLUMN "pointBalance" SET DATA TYPE INTEGER USING FLOOR("pointBalance")::INTEGER;
