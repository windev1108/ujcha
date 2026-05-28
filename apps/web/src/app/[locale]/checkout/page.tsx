import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutPageShell } from "./components/CheckoutPageShell";

export const metadata: Metadata = {
  title: "Thanh toán",
  description:
    "Hoàn tất đơn hàng — giao hàng, tại bàn hoặc nhận tại quán.",
};

function CheckoutFallback() {
  return (
    <div className="min-h-[50vh] bg-surface-soft" aria-hidden />
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutFallback />}>
      <CheckoutPageShell />
    </Suspense>
  );
}
