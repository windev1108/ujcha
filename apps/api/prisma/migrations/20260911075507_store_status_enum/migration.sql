-- CreateEnum
CREATE TYPE "StoreOperationStatus" AS ENUM ('opening', 'closed', 'busy');

-- CreateTable
CREATE TABLE "StoreHoursConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "openMinutes" INTEGER NOT NULL DEFAULT 420,
    "closeMinutes" INTEGER NOT NULL DEFAULT 1320,
    "status" "StoreOperationStatus" NOT NULL DEFAULT 'opening',
    "statusReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreHoursConfig_pkey" PRIMARY KEY ("id")
);
