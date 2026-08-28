-- DropIndex
DROP INDEX "GroupOrderParticipant_groupOrderId_deviceId_key";

-- AlterTable
ALTER TABLE "GroupOrderConfig" ADD COLUMN     "limitParticipants" INTEGER NOT NULL DEFAULT 0;
