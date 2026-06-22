"use client";

import { ROUTES } from "@/lib/routes";
import { RevealSection, easeOutSmooth } from "./RevealSection";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useProductsQuery } from "@/services/product/hooks";
import { ProductCard, ProductCardSkeleton } from "@/components/product/ProductCard";
import { useTranslations } from "next-intl";

export function ProductGallery() {
  const { data: products, isLoading } = useProductsQuery();
  const displayed = products
    ?.filter((p) => p.isAvailable)
    .sort((a, b) => Number(b.isBestSeller) - Number(a.isBestSeller))
    .slice(0, 12) ?? [];
  const t = useTranslations()
  if (!isLoading && displayed.length === 0) return null;

  return (
    <RevealSection className="px-4 py-12 sm:px-6 sm:py-16">
      <div className="container mx-auto">
        {/* Section header */}
        <motion.div
          className="mb-10 flex flex-col gap-4 sm:mb-12 sm:flex-row sm:items-end sm:justify-between"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: easeOutSmooth }}
        >
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              {t('menu')}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {t('highly_recommend_products')}
            </h2>
          </div>
          <Link
            href={ROUTES.MENU}
            className="inline-flex items-center gap-1 text-sm font-medium text-foreground outline-offset-4 hover:text-kun-primary transition-colors"
          >
            {t('see_all')}
            <ChevronRight className="size-4" />
          </Link>
        </motion.div>

        {/* Grid — 12 items divides evenly by 2, 3, 4, 6 */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5 2xl:grid-cols-6">
          {isLoading
            ? Array.from({ length: 12 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : displayed.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
        </div>
      </div>
    </RevealSection>
  );
}
