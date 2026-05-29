import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PromotionsPageShell } from "./components/PromotionsPageShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t("promotions"),
    description: "Chiến dịch tích điểm, ưu đãi giới hạn và các phần thưởng dành riêng cho khách hàng UjCha.",
    openGraph: {
      title: "Khuyến mãi",
      description: "Chiến dịch tích điểm và ưu đãi giới hạn tại UjCha.",
      url: "/promotions",
    },
  };
}

export default function PromotionsPage() {
  return <PromotionsPageShell />;
}
