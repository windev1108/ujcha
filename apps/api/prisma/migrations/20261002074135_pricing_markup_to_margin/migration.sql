-- 1) Đổi tên cột (giữ dữ liệu)
ALTER TABLE "Category"      RENAME COLUMN "pricingMarkupPercent" TO "pricingMarginPercent";
ALTER TABLE "Product"       RENAME COLUMN "pricingMarkupPercent" TO "pricingMarginPercent";
ALTER TABLE "PricingConfig" RENAME COLUMN "defaultMarkupPercent" TO "defaultMarginPercent";

-- 2) Quy đổi markup → biên gộp: margin = markup / (100 + markup) * 100
UPDATE "Category"
SET "pricingMarginPercent" = ROUND("pricingMarginPercent" / (100 + "pricingMarginPercent") * 100, 2)
WHERE "pricingMarginPercent" IS NOT NULL AND "pricingMarginPercent" > -100;

UPDATE "Product"
SET "pricingMarginPercent" = ROUND("pricingMarginPercent" / (100 + "pricingMarginPercent") * 100, 2)
WHERE "pricingMarginPercent" IS NOT NULL AND "pricingMarginPercent" > -100;

UPDATE "PricingConfig"
SET "defaultMarginPercent" = ROUND("defaultMarginPercent" / (100 + "defaultMarginPercent") * 100, 2)
WHERE "defaultMarginPercent" IS NOT NULL AND "defaultMarginPercent" > -100;