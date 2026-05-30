-- AlterEnum: add new shipper workflow statuses
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'picked_up';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'arrived';
