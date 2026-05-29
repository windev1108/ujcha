import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { QuickOrderPageShell } from "./components/QuickOrderPageShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t("quick_order_page_title"),
    description:
      "Quét và đặt món tại bàn — matcha, cà phê, trà và bánh, thanh toán nhanh chóng.",
  };
}

export default function DatMonNhanhPage() {
  return <QuickOrderPageShell />;
}
