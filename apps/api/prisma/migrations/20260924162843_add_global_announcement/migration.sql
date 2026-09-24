-- CreateEnum
CREATE TYPE "AnnouncementType" AS ENUM ('info', 'feature', 'warning');

-- CreateEnum
CREATE TYPE "AnnouncementFrequency" AS ENUM ('session', 'once');

-- CreateTable
CREATE TABLE "GlobalAnnouncement" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "type" "AnnouncementType" NOT NULL DEFAULT 'info',
    "frequency" "AnnouncementFrequency" NOT NULL DEFAULT 'session',
    "title" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "ctaLabel" TEXT,
    "imageUrl" TEXT,
    "ctaUrl" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalAnnouncement_pkey" PRIMARY KEY ("id")
);
