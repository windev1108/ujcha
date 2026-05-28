-- CreateTable
CREATE TABLE "ReferralMilestoneClaim" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tier" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralMilestoneClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReferralMilestoneClaim_userId_idx" ON "ReferralMilestoneClaim"("userId");

-- CreateIndex
CREATE INDEX "ReferralMilestoneClaim_tier_idx" ON "ReferralMilestoneClaim"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralMilestoneClaim_userId_tier_key" ON "ReferralMilestoneClaim"("userId", "tier");

-- AddForeignKey
ALTER TABLE "ReferralMilestoneClaim" ADD CONSTRAINT "ReferralMilestoneClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
