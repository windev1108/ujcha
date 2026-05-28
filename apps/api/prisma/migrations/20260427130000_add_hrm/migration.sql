-- Migration: HRM module — StoreLocation, StaffFaceProfile, StaffAttendance

CREATE TYPE "AttendanceType" AS ENUM ('checkin', 'checkout');

CREATE TABLE "StoreLocation" (
    "id"           TEXT NOT NULL DEFAULT 'default',
    "lat"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lng"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "radiusMeters" INTEGER NOT NULL DEFAULT 100,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StoreLocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffFaceProfile" (
    "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
    "adminId"        UUID NOT NULL,
    "descriptorJson" JSONB NOT NULL,
    "imageUrl"       TEXT,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffFaceProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffFaceProfile_adminId_key" ON "StaffFaceProfile"("adminId");

ALTER TABLE "StaffFaceProfile"
    ADD CONSTRAINT "StaffFaceProfile_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StaffAttendance" (
    "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
    "adminId"        UUID NOT NULL,
    "type"           "AttendanceType" NOT NULL,
    "lat"            DOUBLE PRECISION,
    "lng"            DOUBLE PRECISION,
    "distanceMeters" DOUBLE PRECISION,
    "faceDistance"   DOUBLE PRECISION,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffAttendance_adminId_createdAt_idx" ON "StaffAttendance"("adminId", "createdAt");
CREATE INDEX "StaffAttendance_createdAt_idx"          ON "StaffAttendance"("createdAt");

ALTER TABLE "StaffAttendance"
    ADD CONSTRAINT "StaffAttendance_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default store location row so GET always returns a record
INSERT INTO "StoreLocation" ("id", "lat", "lng", "radiusMeters", "updatedAt")
VALUES ('default', 0, 0, 100, NOW())
ON CONFLICT ("id") DO NOTHING;
