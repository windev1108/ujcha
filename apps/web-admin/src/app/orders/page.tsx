import type { Metadata } from "next";

import { OrdersPageClient } from "./components/OrdersPageClient";

export const metadata: Metadata = {
  title: "Đơn hàng — UjCha Admin",
  description: "Quản lý đơn, KPI và gán shipper",
};

export default function OrdersPage() {
  return <OrdersPageClient />;
}
