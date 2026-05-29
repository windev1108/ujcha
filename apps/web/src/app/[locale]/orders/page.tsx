import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { OrdersPageShell } from "./components/OrdersPageShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t("order_history"),
  };
}

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersPageShell />
    </Suspense>
  );
}
