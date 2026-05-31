-- DropForeignKey
ALTER TABLE "Shipper" DROP CONSTRAINT "Shipper_adminId_fkey";

-- AddForeignKey
ALTER TABLE "Shipper" ADD CONSTRAINT "Shipper_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
