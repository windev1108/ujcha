-- AlterTable
ALTER TABLE "GroupOrderParticipant" ADD COLUMN     "deviceId" TEXT;

-- CreateIndex
CREATE INDEX "GroupOrderParticipant_groupOrderId_deviceId_idx" ON "GroupOrderParticipant"("groupOrderId", "deviceId");
