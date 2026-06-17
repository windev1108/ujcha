-- Replace non-unique composite index with unique constraint.
-- PostgreSQL treats NULLs as distinct, so multiple participants without a deviceId remain allowed.
DROP INDEX IF EXISTS "GroupOrderParticipant_groupOrderId_deviceId_idx";

CREATE UNIQUE INDEX "GroupOrderParticipant_groupOrderId_deviceId_key"
  ON "GroupOrderParticipant"("groupOrderId", "deviceId");
