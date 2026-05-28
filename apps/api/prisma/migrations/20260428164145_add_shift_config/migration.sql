-- CreateTable
CREATE TABLE "ShiftConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "startMinutes" INTEGER NOT NULL DEFAULT 480,
    "endMinutes" INTEGER NOT NULL DEFAULT 1020,
    "toleranceMinutes" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftConfig_pkey" PRIMARY KEY ("id")
);
