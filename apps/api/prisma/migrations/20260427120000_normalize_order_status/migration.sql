-- Migration: normalize OrderStatus
-- Replace `paid` (confusing with paymentStatus field) → `confirmed`
-- Add `delivering` for in-transit delivery orders
--
-- Strategy: create new enum type directly, swap the column with a CASE in USING
-- (avoids ALTER TYPE ADD VALUE which cannot be used in the same transaction as
--  statements referencing the new value — PostgreSQL limitation)

CREATE TYPE "OrderStatus_new" AS ENUM (
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'delivering',
  'completed',
  'cancelled'
);

ALTER TABLE "Order"
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE "OrderStatus_new"
    USING (
      CASE status::text
        WHEN 'paid' THEN 'confirmed'::"OrderStatus_new"
        ELSE status::text::"OrderStatus_new"
      END
    ),
  ALTER COLUMN status SET DEFAULT 'pending'::"OrderStatus_new";

DROP TYPE "OrderStatus";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
