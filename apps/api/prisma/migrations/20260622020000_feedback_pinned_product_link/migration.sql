ALTER TABLE "Feedback" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Feedback" ADD COLUMN "linkedProductId" UUID;
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_linkedProductId_fkey"
  FOREIGN KEY ("linkedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Feedback_isPinned_idx" ON "Feedback"("isPinned");
