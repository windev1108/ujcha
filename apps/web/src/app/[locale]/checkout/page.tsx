import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CheckoutPageShell } from "./components/CheckoutPageShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t("payment"),
    description:
      "Hoàn tất đơn hàng — giao hàng, tại bàn hoặc nhận tại quán.",
  };
}

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
