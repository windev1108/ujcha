-- Giảm giá theo sản phẩm (0–100)
ALTER TABLE "Product" ADD COLUMN "discountPercent" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ShopSettings" (
    "id" TEXT NOT NULL,
    "globalDiscountPercent" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ShopSettings" ("id", "globalDiscountPercent", "updatedAt")
VALUES ('default', 0, CURRENT_TIMESTAMP);
