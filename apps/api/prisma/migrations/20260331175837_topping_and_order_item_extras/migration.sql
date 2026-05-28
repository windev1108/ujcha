-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "extrasJson" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "note" TEXT,
ADD COLUMN     "optionsJson" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "Topping" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Topping_isActive_idx" ON "Topping"("isActive");

-- CreateIndex
CREATE INDEX "Topping_sortOrder_idx" ON "Topping"("sortOrder");
