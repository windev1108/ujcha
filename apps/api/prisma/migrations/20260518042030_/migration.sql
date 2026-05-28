-- CreateTable
CREATE TABLE "PosRelease" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "downloadUrl" TEXT NOT NULL DEFAULT '',
    "releaseNotes" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosRelease_pkey" PRIMARY KEY ("id")
);
