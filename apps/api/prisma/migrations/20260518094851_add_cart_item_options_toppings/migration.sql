-- DropIndex
DROP INDEX "CartItem_cartId_productId_key";

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "selectedOptions" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "CartItemTopping" (
    "id" UUID NOT NULL,
    "cartItemId" UUID NOT NULL,
    "toppingId" UUID NOT NULL,

    CONSTRAINT "CartItemTopping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CartItemTopping_cartItemId_idx" ON "CartItemTopping"("cartItemId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItemTopping_cartItemId_toppingId_key" ON "CartItemTopping"("cartItemId", "toppingId");

-- AddForeignKey
ALTER TABLE "CartItemTopping" ADD CONSTRAINT "CartItemTopping_cartItemId_fkey" FOREIGN KEY ("cartItemId") REFERENCES "CartItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItemTopping" ADD CONSTRAINT "CartItemTopping_toppingId_fkey" FOREIGN KEY ("toppingId") REFERENCES "Topping"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
