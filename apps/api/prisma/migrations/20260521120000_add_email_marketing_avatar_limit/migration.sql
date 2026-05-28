-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailMarketingEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "lastAvatarUploadAt" TIMESTAMP(3);
