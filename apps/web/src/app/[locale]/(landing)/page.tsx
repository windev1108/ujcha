import type { Metadata } from "next";
import { Categories } from "@/app/[locale]/(landing)/components/Categories";
import { Hero } from "@/app/[locale]/(landing)/components/Hero";
import { ProductGallery } from "@/app/[locale]/(landing)/components/ProductGallery";
import { PromoBanner } from "@/app/[locale]/(landing)/components/PromoBanner";

export const metadata: Metadata = {
  title: "UjCha — Matcha & Đồ uống thủ công",
  description: "Khám phá matcha ceremonial grade, cà phê, trà thủ công và đồ uống theo mùa. Nguồn gốc bền vững — giao hàng tận nơi.",
  openGraph: {
    title: "UjCha — Matcha & Đồ uống thủ công",
    description: "Matcha ceremonial grade, cà phê và đồ uống thủ công tại UjCha. Nguồn gốc bền vững, chất lượng cao.",
    url: "/",
  },
};

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <Hero />
      <Categories />
      <ProductGallery />
      <PromoBanner />
    </div>
  );
}
