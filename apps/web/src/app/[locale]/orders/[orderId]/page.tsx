import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { OrderDetailShell } from "./components/OrderDetailShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t("order_detail_title"),
  };
}

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
