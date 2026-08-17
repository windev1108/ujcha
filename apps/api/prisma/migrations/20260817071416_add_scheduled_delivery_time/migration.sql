-- AlterTable
ALTER TABLE "GroupOrder" ADD COLUMN     "scheduledDeliveryTime" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "scheduledDeliveryTime" TIMESTAMP(3);
