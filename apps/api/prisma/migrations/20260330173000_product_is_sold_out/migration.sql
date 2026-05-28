-- Đánh dấu hết hàng (khách vẫn thấy món khi đang hiển thị)
ALTER TABLE "Product" ADD COLUMN "isSoldOut" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Product_isSoldOut_idx" ON "Product"("isSoldOut");
