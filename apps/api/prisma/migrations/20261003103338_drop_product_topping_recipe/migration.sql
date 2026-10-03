/*
  Warnings:

  - You are about to drop the `ProductToppingRecipeItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProductToppingRecipeItem" DROP CONSTRAINT "ProductToppingRecipeItem_ingredientId_fkey";

-- DropForeignKey
ALTER TABLE "ProductToppingRecipeItem" DROP CONSTRAINT "ProductToppingRecipeItem_productId_fkey";

-- DropTable
DROP TABLE "ProductToppingRecipeItem";
