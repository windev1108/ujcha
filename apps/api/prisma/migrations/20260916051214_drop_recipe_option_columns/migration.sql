/*
  Warnings:

  - You are about to drop the column `optionGroupName` on the `ProductRecipeItem` table. All the data in the column will be lost.
  - You are about to drop the column `optionValueLabel` on the `ProductRecipeItem` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[productId,ingredientId,scopeKey]` on the table `ProductRecipeItem` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ProductRecipeItem_productId_ingredientId_optionGroupName_op_key";

-- AlterTable
ALTER TABLE "ProductRecipeItem" DROP COLUMN "optionGroupName",
DROP COLUMN "optionValueLabel";

-- CreateIndex
CREATE UNIQUE INDEX "ProductRecipeItem_productId_ingredientId_scopeKey_key" ON "ProductRecipeItem"("productId", "ingredientId", "scopeKey");
