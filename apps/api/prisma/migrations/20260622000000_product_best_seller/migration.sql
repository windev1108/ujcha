-- Gắn nhãn bán chạy cho sản phẩm: badge Best Seller + ưu tiên sắp xếp trên LP
ALTER TABLE "Product" ADD COLUMN "isBestSeller" BOOLEAN NOT NULL DEFAULT false;
