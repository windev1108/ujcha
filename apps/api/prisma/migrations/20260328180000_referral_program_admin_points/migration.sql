-- AlterTable
ALTER TABLE "User" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ReferralProgramConfig" (
    "id" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minOrderAmount" DECIMAL(12,2) NOT NULL,
    "referrerRewardPoints" INTEGER NOT NULL,
    "refereeVoucherAmount" DECIMAL(12,2) NOT NULL,
    "refereeVoucherName" TEXT NOT NULL DEFAULT 'Thưởng giới thiệu',
    "maxReferrerRewardsPerDay" INTEGER NOT NULL DEFAULT 20,
    "blockSameIpAsReferrer" BOOLEAN NOT NULL DEFAULT true,
    "blockSameDeviceAsReferrer" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralProgramConfig_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ReferralProgramConfig" (
    "id", "isActive", "minOrderAmount", "referrerRewardPoints", "refereeVoucherAmount",
    "refereeVoucherName", "maxReferrerRewardsPerDay", "blockSameIpAsReferrer", "blockSameDeviceAsReferrer",
    "createdAt", "updatedAt"
) VALUES (
    gen_random_uuid(), true, 0, 50, 30000,
    'Thưởng giới thiệu', 20, true, true,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

-- AlterTable
ALTER TABLE "ReferralReward" ADD COLUMN "referrerPointsGranted" INTEGER;
ALTER TABLE "ReferralReward" ADD COLUMN "refereeVoucherId" UUID;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_refereeVoucherId_fkey" FOREIGN KEY ("refereeVoucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "AdminActionLog" (
    "id" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "targetUserId" UUID,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActionLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AdminActionLog" ADD CONSTRAINT "AdminActionLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "AdminActionLog_adminId_createdAt_idx" ON "AdminActionLog"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminActionLog_action_idx" ON "AdminActionLog"("action");
