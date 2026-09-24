-- AlterTable
ALTER TABLE "GroupOrderParticipant" ADD COLUMN     "pointDiscountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "pointsConsumed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pointsReserved" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pointsToUse" INTEGER NOT NULL DEFAULT 0;
