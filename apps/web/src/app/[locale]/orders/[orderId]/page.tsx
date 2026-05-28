import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderDetailShell } from "./components/OrderDetailShell";

export const metadata: Metadata = {
  title: "Chi tiết đơn hàng",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId: paymentCode } = await params;
  return (
    <Suspense>
      <OrderDetailShell paymentCode={paymentCode} />
    </Suspense>
  );
}
