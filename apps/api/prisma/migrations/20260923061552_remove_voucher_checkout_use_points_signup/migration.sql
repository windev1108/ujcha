/*
  Warnings:

  - You are about to drop the column `welcomeVoucherId` on the `ReferralProgramConfig` table. All the data in the column will be lost.
  - You are about to drop the `PointRewardCatalog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PointRewardCatalog" DROP CONSTRAINT "PointRewardCatalog_voucherId_fkey";

-- DropForeignKey
ALTER TABLE "ReferralProgramConfig" DROP CONSTRAINT "ReferralProgramConfig_welcomeVoucherId_fkey";

-- AlterTable
ALTER TABLE "ReferralProgramConfig" DROP COLUMN "welcomeVoucherId",
ADD COLUMN     "signupBonusPoints" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "PointRewardCatalog";
