-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN     "costPerUnit" DECIMAL(14,4),
ADD COLUMN     "costUpdatedAt" TIMESTAMP(3);
