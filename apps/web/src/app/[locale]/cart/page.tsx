import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CartPageShell } from "./components/CartPageShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t("cart"),
    description:
      "Xem giỏ hàng của bạn — matcha, dụng cụ và những món đã chọn cho ritual hàng ngày.",
  };
}

export default function CartPage() {
  return <CartPageShell />;
}
