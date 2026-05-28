-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "address" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "StaffAttendance" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "StaffFaceProfile" ALTER COLUMN "id" DROP DEFAULT;
