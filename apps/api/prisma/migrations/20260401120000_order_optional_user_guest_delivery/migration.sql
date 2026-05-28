-- Cho phép đơn không gắn User (khách lẻ / POS); địa chỉ giao dạng text khi không có member.
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_userId_fkey";

ALTER TABLE "Order" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "Order" ADD COLUMN "guestDeliveryAddress" TEXT;
ALTER TABLE "Order" ADD COLUMN "guestDeliveryPhone" TEXT;
ALTER TABLE "Order" ADD COLUMN "guestDeliveryName" TEXT;

ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
