/*
  Warnings:

  - You are about to drop the `CartItemTopping` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Topping` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VariantGroup` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CartItemTopping" DROP CONSTRAINT "CartItemTopping_cartItemId_fkey";

-- DropForeignKey
ALTER TABLE "CartItemTopping" DROP CONSTRAINT "CartItemTopping_toppingId_fkey";

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "toppingsJson" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "toppings" JSONB NOT NULL DEFAULT '[]';

-- DropTable
DROP TABLE "CartItemTopping";

-- DropTable
DROP TABLE "Topping";

-- DropTable
DROP TABLE "VariantGroup";
