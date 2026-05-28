-- AlterTable: replace fixed referrerRewardPoints + refereeVoucher with commission % + welcome voucher config
ALTER TABLE "ReferralProgramConfig"
  ADD COLUMN "referrerCommissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 5,
  ADD COLUMN "welcomeVoucherId" UUID;

-- AddForeignKey
ALTER TABLE "ReferralProgramConfig"
  ADD CONSTRAINT "ReferralProgramConfig_welcomeVoucherId_fkey"
  FOREIGN KEY ("welcomeVoucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
