-- AlterTable
ALTER TABLE "Sticker" ADD COLUMN     "albumId" UUID;

-- CreateTable
CREATE TABLE "StickerAlbum" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StickerAlbum_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StickerAlbum_isActive_idx" ON "StickerAlbum"("isActive");

-- CreateIndex
CREATE INDEX "StickerAlbum_sortOrder_idx" ON "StickerAlbum"("sortOrder");

-- CreateIndex
CREATE INDEX "Sticker_albumId_idx" ON "Sticker"("albumId");

-- AddForeignKey
ALTER TABLE "Sticker" ADD CONSTRAINT "Sticker_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "StickerAlbum"("id") ON DELETE SET NULL ON UPDATE CASCADE;
