-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "participantId" UUID,
    "userId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_deviceId_idx" ON "PushSubscription"("deviceId");

-- CreateIndex
CREATE INDEX "PushSubscription_participantId_idx" ON "PushSubscription"("participantId");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "GroupOrderParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
