-- AlterTable
ALTER TABLE "Admin" ADD COLUMN "googleId" TEXT;

-- AlterTable
ALTER TABLE "Admin" ALTER COLUMN "password" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Admin_googleId_key" ON "Admin"("googleId");
