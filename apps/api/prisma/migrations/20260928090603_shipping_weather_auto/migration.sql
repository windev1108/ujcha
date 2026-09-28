-- AlterTable
ALTER TABLE "ShippingConfig" ADD COLUMN     "weatherAutoFee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "weatherAutoMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weatherCheckedAt" TIMESTAMP(3),
ADD COLUMN     "weatherLabel" TEXT,
ADD COLUMN     "weatherLowerStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "weatherRainTiersJson" JSONB,
ADD COLUMN     "weatherSnapshotJson" JSONB,
ADD COLUMN     "weatherStaleMinutes" INTEGER NOT NULL DEFAULT 45,
ADD COLUMN     "weatherThunderstormFee" INTEGER NOT NULL DEFAULT 8000,
ADD COLUMN     "weatherWindTiersJson" JSONB;
