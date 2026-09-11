/*
  Warnings:

  - A unique constraint covering the columns `[productId,ingredientId,optionGroupName,optionValueLabel]` on the table `ProductRecipeItem` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ProductRecipeItem_productId_ingredientId_key";

-- AlterTable
ALTER TABLE "ProductRecipeItem" ADD COLUMN     "optionGroupName" TEXT,
ADD COLUMN     "optionValueLabel" TEXT;

-- CreateTable
CREATE TABLE "ProductToppingRecipeItem" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "toppingId" TEXT NOT NULL,
    "ingredientId" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductToppingRecipeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductToppingRecipeItem_productId_idx" ON "ProductToppingRecipeItem"("productId");

-- CreateIndex
CREATE INDEX "ProductToppingRecipeItem_toppingId_idx" ON "ProductToppingRecipeItem"("toppingId");

-- CreateIndex
CREATE INDEX "ProductToppingRecipeItem_ingredientId_idx" ON "ProductToppingRecipeItem"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductToppingRecipeItem_productId_toppingId_ingredientId_key" ON "ProductToppingRecipeItem"("productId", "toppingId", "ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRecipeItem_productId_ingredientId_optionGroupName_op_key" ON "ProductRecipeItem"("productId", "ingredientId", "optionGroupName", "optionValueLabel");

-- AddForeignKey
ALTER TABLE "ProductToppingRecipeItem" ADD CONSTRAINT "ProductToppingRecipeItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductToppingRecipeItem" ADD CONSTRAINT "ProductToppingRecipeItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
