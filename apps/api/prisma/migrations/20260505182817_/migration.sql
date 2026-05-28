-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "optionDetailsJson" JSONB NOT NULL DEFAULT '[]';
