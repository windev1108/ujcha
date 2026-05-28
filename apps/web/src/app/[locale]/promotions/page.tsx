import type { Metadata } from "next";
import { PromotionsPageShell } from "./components/PromotionsPageShell";

export const metadata: Metadata = {
  title: "Khuyến mãi",
  description: "Chiến dịch tích điểm, ưu đãi giới hạn và các phần thưởng dành riêng cho khách hàng UjCha.",
  openGraph: {
    title: "Khuyến mãi",
    description: "Chiến dịch tích điểm và ưu đãi giới hạn tại UjCha.",
    url: "/promotions",
  },
};

export default function PromotionsPage() {
  return <PromotionsPageShell />;
}
