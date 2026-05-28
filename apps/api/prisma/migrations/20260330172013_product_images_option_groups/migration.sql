-- Bước 1: thêm cột JSON mới
ALTER TABLE "Product" ADD COLUMN "imageUrls" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Product" ADD COLUMN "optionGroups" JSONB NOT NULL DEFAULT '[]';

-- Bước 2: chuyển ảnh đơn sang mảng URL
UPDATE "Product"
SET "imageUrls" = json_build_array("imageUrl")::jsonb
WHERE "imageUrl" IS NOT NULL AND trim("imageUrl") <> '';

-- Bước 3: bỏ cột cũ
ALTER TABLE "Product" DROP COLUMN "imageUrl";
ALTER TABLE "Product" DROP COLUMN "stockQuantity";
