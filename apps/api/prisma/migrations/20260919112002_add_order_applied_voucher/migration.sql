-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "appliedUserVoucherId" UUID;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_appliedUserVoucherId_fkey" FOREIGN KEY ("appliedUserVoucherId") REFERENCES "UserVoucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
