-- CreateTable
CREATE TABLE "GlobalToppingRecipeItem" (
    "id" UUID NOT NULL,
    "nameKey" TEXT NOT NULL,
    "ingredientId" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalToppingRecipeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GlobalToppingRecipeItem_nameKey_idx" ON "GlobalToppingRecipeItem"("nameKey");

-- CreateIndex
CREATE INDEX "GlobalToppingRecipeItem_ingredientId_idx" ON "GlobalToppingRecipeItem"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalToppingRecipeItem_nameKey_ingredientId_key" ON "GlobalToppingRecipeItem"("nameKey", "ingredientId");

-- AddForeignKey
ALTER TABLE "GlobalToppingRecipeItem" ADD CONSTRAINT "GlobalToppingRecipeItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
