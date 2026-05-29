"use client";

import { useParams } from "next/navigation";
import { useProductBySlugQuery } from "@/services/product/hooks";
import { ProductImageGallery } from "./ProductImageGallery";
import { ProductOptionPanel } from "./ProductOptionPanel";
import { RelatedProducts } from "./RelatedProducts";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

const PLACEHOLDER_BG = ["#1a3c34", "#2d1a0a", "#0d2035", "#1a0d2e"];

function DetailSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[4fr_6fr] lg:gap-14">
      <div className="flex flex-col gap-3">
        <div className="aspect-[3/4] w-full animate-pulse rounded-3xl bg-black/[0.06]" />
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-[3/4] w-[72px] shrink-0 animate-pulse rounded-xl bg-black/[0.06]" />
          ))}
        </div>
      </div>
      <div className="space-y-5">
        <div className="flex gap-2">
          <div className="h-6 w-20 animate-pulse rounded-full bg-black/[0.06]" />
        </div>
        <div className="h-10 w-3/4 animate-pulse rounded-lg bg-black/[0.06]" />
        <div className="h-8 w-1/3 animate-pulse rounded bg-black/[0.06]" />
        <div className="space-y-2 pt-2">
          <div className="h-4 w-full animate-pulse rounded bg-black/[0.06]" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-black/[0.06]" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-black/[0.06]" />
        </div>
      </div>
    </div>
  );
}

export function ProductDetailPageShell() {
  const t = useTranslations();
  const params = useParams<{ slug: string }>();
  const { data: product, isLoading, isError } = useProductBySlugQuery(params.slug ?? "");


  return (
    <div
      className="relative min-h-screen"
    >
      {/* Blur + white wash overlay */}
      <div className="relative z-10 container mx-auto px-4 pb-20 pt-6 sm:px-6 sm:pt-8">
        {/* Breadcrumb */}
        <motion.nav
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8 flex items-center gap-1.5 text-sm text-muted"
          aria-label="Breadcrumb"
        >
          <Link href={ROUTES.HOME} className="transition-colors hover:text-foreground">
            {t("home")}
          </Link>
          <ChevronRight className="size-3.5 opacity-40" />
          <Link href={ROUTES.MENU} className="transition-colors hover:text-foreground">
            {t("menu")}
          </Link>
          {product && (
            <>
              <ChevronRight className="size-3.5 opacity-40" />
              <span className="max-w-[180px] truncate font-medium text-foreground">
                {product.name}
              </span>
            </>
          )}
        </motion.nav>

        {isLoading && <DetailSkeleton />}

        {isError && (
          <div className="flex flex-col items-center justify-center gap-4 py-32 text-muted">
            <p className="text-base font-medium text-foreground">{t("product_not_found")}</p>
            <Link
              href={ROUTES.MENU}
              className="inline-flex items-center gap-1.5 text-sm text-kun-products-forest underline underline-offset-4"
            >
              <ArrowLeft className="size-4" />
              {t("back_to_menu")}
            </Link>
          </div>
        )}

        {product && (
          <div className="space-y-16 lg:space-y-20">
            {/* Main detail grid — image 4fr / options 6fr */}
            <section className="grid gap-10 lg:grid-cols-[4fr_6fr] lg:items-start lg:gap-14">
              <ProductImageGallery
                images={product.imageUrls}
                name={product.name}
                placeholderBg={PLACEHOLDER_BG[0]}
              />

              <div className="lg:sticky lg:top-24">
                <ProductOptionPanel product={product} />
              </div>
            </section>

            <RelatedProducts categorySlug={product.category.slug} excludeId={product.id} />
          </div>
        )}
      </div>
    </div>
  );
}
