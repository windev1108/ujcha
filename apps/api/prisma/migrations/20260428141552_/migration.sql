-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];
