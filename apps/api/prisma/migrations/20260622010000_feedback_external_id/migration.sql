ALTER TABLE "Feedback" ADD COLUMN "externalId" TEXT;
CREATE UNIQUE INDEX "Feedback_externalId_key" ON "Feedback"("externalId");
