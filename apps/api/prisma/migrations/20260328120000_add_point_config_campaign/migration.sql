-- CreateTable
CREATE TABLE "PointConfig" (
    "id" UUID NOT NULL,
    "pointRate" INTEGER NOT NULL,
    "earnPercent" DECIMAL(5,2) NOT NULL,
    "maxUsagePercent" DECIMAL(5,2) NOT NULL,
    "minOrderAmount" DECIMAL(12,2) NOT NULL,
    "delayHours" INTEGER NOT NULL,
    "expireDays" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PointConfig_isActive_idx" ON "PointConfig"("isActive");

-- Chỉ một config active tại một thời điểm
CREATE UNIQUE INDEX "PointConfig_one_active_idx" ON "PointConfig"("isActive") WHERE "isActive" = true;

-- CreateTable
CREATE TABLE "PointCampaign" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "earnPercent" DECIMAL(5,2) NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PointCampaign_startAt_endAt_idx" ON "PointCampaign"("startAt", "endAt");

-- CreateIndex
CREATE INDEX "PointCampaign_isActive_idx" ON "PointCampaign"("isActive");

-- Bản ghi mặc định (một config active)
INSERT INTO "PointConfig" ("id", "pointRate", "earnPercent", "maxUsagePercent", "minOrderAmount", "delayHours", "expireDays", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 100, 1.00, 10.00, 0, 0, 365, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
