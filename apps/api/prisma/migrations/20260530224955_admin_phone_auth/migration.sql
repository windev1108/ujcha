-- Admin: switch primary credential from email (Google) to phone + password

-- 1. Drop googleId column
ALTER TABLE "Admin" DROP COLUMN IF EXISTS "googleId";

-- 2. Make email optional
ALTER TABLE "Admin" ALTER COLUMN "email" DROP NOT NULL;

-- 3. Add isActive flag
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
