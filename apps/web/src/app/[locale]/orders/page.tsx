import type { Metadata } from "next";
import { Suspense } from "react";
import { OrdersPageShell } from "./components/OrdersPageShell";

export const metadata: Metadata = {
  title: "Lịch sử đơn hàng",
};

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersPageShell />
    </Suspense>
  );
}
