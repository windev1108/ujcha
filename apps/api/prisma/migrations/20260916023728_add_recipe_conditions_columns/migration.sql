-- AlterTable
ALTER TABLE "ProductRecipeItem" ADD COLUMN     "conditions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "scopeKey" TEXT NOT NULL DEFAULT 'ALL';
