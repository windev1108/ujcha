"use client";

import { useProductsQuery } from "@/services/product/hooks";
import { ProductCard, ProductCardSkeleton } from "@/components/product/ProductCard";
import { motion } from "motion/react";
import { easeOutSmooth } from "@/app/[locale]/(landing)/components/RevealSection";
import { SearchX } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  categorySlug?: string;
  search?: string;
};

export function ProductGrid({ categorySlug, search }: Props) {
  const t = useTranslations();
  const { data: products, isLoading } = useProductsQuery(
    categorySlug ? { categorySlug } : undefined,
  );

  const filtered = search
    ? (products ?? []).filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.description ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : products;

  const available = filtered?.filter((p) => p.isAvailable) ?? [];

  if (!isLoading && available.length === 0) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center gap-4 py-28 text-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: easeOutSmooth }}
      >
        <div className="flex size-16 items-center justify-center rounded-full bg-surface-card">
          <SearchX className="size-7 text-muted/50" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{t("no_products_found")}</p>
          <p className="text-xs text-muted">
            {search ? t("try_different_search") : t("no_products_in_category")}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Result count */}
      {!isLoading && (
        <motion.p
          className="text-[11px] font-medium text-muted"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          {available.length} {t("products")}
          {search && (
            <span className="ml-1">
              {t("results_for")} <span className="text-foreground">"{search}"</span>
            </span>
          )}
        </motion.p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5 2xl:grid-cols-6">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
          : available.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
      </div>
    </div>
  );
}
