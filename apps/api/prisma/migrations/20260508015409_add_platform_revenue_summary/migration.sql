-- CreateTable
CREATE TABLE "platform_revenue_summaries" (
    "id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "totalEarnings" INTEGER NOT NULL DEFAULT 0,
    "revenue" INTEGER NOT NULL DEFAULT 0,
    "completedOrders" INTEGER NOT NULL DEFAULT 0,
    "cancelledOrders" INTEGER NOT NULL DEFAULT 0,
    "rawJson" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_revenue_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_revenue_summaries_platform_date_idx" ON "platform_revenue_summaries"("platform", "date");

-- CreateIndex
CREATE UNIQUE INDEX "platform_revenue_summaries_platform_date_key" ON "platform_revenue_summaries"("platform", "date");
