"use client";

import { useRef } from "react";
import { useProductsQuery } from "@/services/product/hooks";
import { motion } from "motion/react";
import { revealTransition } from "@/app/[locale]/(landing)/components/RevealSection";
import { Link } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/product/ProductCard";

type Props = { categorySlug: string; excludeId: string };

const SCROLL_STEP = 220;

export function RelatedProducts({ categorySlug, excludeId }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: products } = useProductsQuery({ categorySlug });

  const related = products
    ?.filter((p) => p.id !== excludeId && p.isAvailable)
    .slice(0, 12) ?? [];

  if (related.length === 0) return null;

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: dir === "right" ? SCROLL_STEP * 3 : -SCROLL_STEP * 3,
      behavior: "smooth",
    });
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={revealTransition}
      className="space-y-6"
    >
      <div className="flex items-end justify-between">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Gợi ý
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Sản phẩm cùng loại
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden gap-2 sm:flex">
            <button
              type="button"
              onClick={() => scroll("left")}
              aria-label="Cuộn trái"
              className="flex size-9 items-center justify-center rounded-full border border-black/10 bg-white text-foreground shadow-sm transition hover:border-black/20 hover:shadow"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              aria-label="Cuộn phải"
              className="flex size-9 items-center justify-center rounded-full border border-black/10 bg-white text-foreground shadow-sm transition hover:border-black/20 hover:shadow"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <Link
            href={`${ROUTES.MENU}?category=${categorySlug}`}
            className="hidden text-sm font-medium text-kun-products-forest transition-colors hover:opacity-75 sm:block"
          >
            Xem tất cả
          </Link>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="-mx-4 flex gap-3 overflow-x-auto scroll-smooth px-4 pb-2 snap-x snap-mandatory scrollbar-hide sm:-mx-0 sm:gap-4 sm:px-0"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {related.map((product, index) => (
          <div
            key={product.id}
            className="w-[calc((100%-12px)/2)] shrink-0 snap-start sm:w-[calc((100%-32px)/3)] lg:w-[calc((100%-64px)/4)] xl:w-[calc((100%-80px)/5)]"
          >
            <ProductCard product={product} index={index} />
          </div>
        ))}
      </div>
    </motion.section>
  );
}
