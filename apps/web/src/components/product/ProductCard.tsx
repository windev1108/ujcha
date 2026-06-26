"use client";

import type { ApiProduct } from "@/services/product/types";
import { ROUTES } from "@/lib/routes";
import { motion } from "motion/react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { revealTransition } from "@/app/[locale]/(landing)/components/RevealSection";
import { ShoppingBag, ExternalLink, SpeakerIcon, SparklesIcon, StarIcon } from "lucide-react";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ProductQuickAddModal } from "./ProductQuickAddModal";
import { getDisplayName } from "@/lib/product-name";


const PLACEHOLDER_BG = [
  "#1a3c34", "#2d1a0a", "#0d2035", "#1a0d2e",
  "#1a2e0d", "#2e1a0d", "#0d2e2e", "#2e2a0d",
] as const;

function formatVnd(price: string | number) {
  const n = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

type Props = {
  product: ApiProduct;
  index?: number;
  eager?: boolean;
};

export function ProductCard({ product, index = 0, eager = false }: Props) {
  const locale = useLocale();
  const t = useTranslations();
  const displayName = getDisplayName(product, locale);
  const imageUrl = product.imageUrls[0] ?? null;
  const bgColor = PLACEHOLDER_BG[index % PLACEHOLDER_BG.length];
  const hasDiscount = product.discountPercent > 0;
  const finalPrice = product.finalPrice;

  const [modalOpen, setModalOpen] = useState(false);

  const animProps = eager
    ? {}
    : {
      initial: { opacity: 0, y: 24 },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true, margin: "-32px" },
      transition: { ...revealTransition, delay: (index % 6) * 0.06 },
    };

  return (
    <>
      <motion.div className="h-full" {...animProps}>
        <div className="group flex h-full flex-col overflow-hidden rounded-xl border border-black/[0.06] bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.07)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.14)]">

          {/* Image — opens quick-add modal for all users */}
          <button
            type="button"
            onClick={() => !product.isSoldOut && setModalOpen(true)}
            disabled={product.isSoldOut}
            className="cursor-pointer relative aspect-[4/3] w-full overflow-hidden text-left disabled:cursor-not-allowed"
            style={{ backgroundColor: imageUrl ? undefined : bgColor }}
            aria-label={`${t("add_to_cart")} ${displayName}`}
          >
            <ProductCardImage imageUrl={imageUrl} name={displayName} bgColor={bgColor} />

            {/* Hover overlay */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="absolute inset-x-0 bottom-3 flex translate-y-2 items-center justify-center gap-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              {!product.isSoldOut && (
                <span className="pointer-events-none flex items-center gap-1.5 rounded-full bg-white/95 px-4 py-1.5 text-[11px] font-semibold text-[#1a3c34] shadow-lg backdrop-blur-sm">
                  <ShoppingBag className="size-3.5" />
                  {t("add_to_cart")}
                </span>
              )}
            </div>

            {/* Mobile quick-add badge */}
            {!product.isSoldOut && (
              <div className="absolute bottom-2.5 right-2.5 sm:hidden">
                <span className="flex size-7 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur-sm">
                  <ShoppingBag className="size-3.5 text-[#1a3c34]" />
                </span>
              </div>
            )}

            <ProductCardBadges hasDiscount={hasDiscount} discountPercent={product.discountPercent} isSoldOut={product.isSoldOut} isBestSeller={product.isBestSeller} />
          </button>

          {/* Info */}
          <div className="flex flex-1 flex-col px-3 pb-3.5 pt-2.5 sm:px-4 sm:pb-4 sm:pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              {getDisplayName(product.category, locale)}
            </p>

            {/* Name — click opens detail page */}
            <Link
              href={`${ROUTES.MENU}/${product.slug}`}
              className="mt-1 flex-1 hover:underline hover:underline-offset-2"
            >
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground sm:text-[15px]">
                {displayName}
              </h3>
            </Link>

            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <p className="text-sm font-bold tabular-nums text-kun-products-forest sm:text-base">
                  {formatVnd(finalPrice)}
                </p>
                {hasDiscount && (
                  <p className="text-xs tabular-nums text-muted line-through">
                    {formatVnd(product.price)}
                  </p>
                )}
              </div>

              {/* Detail page shortcut */}
              <Link
                href={`${ROUTES.MENU}/${product.slug}`}
                className="shrink-0 rounded-full p-1 text-muted opacity-0 transition-all group-hover:opacity-100 hover:bg-black/[0.05] hover:text-foreground"
                aria-label={`Xem chi tiết ${displayName}`}
                title="Xem chi tiết"
              >
                <ExternalLink className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      <ProductQuickAddModal
        product={product}
        productIndex={index}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

function ProductCardImage({ imageUrl, name, bgColor }: { imageUrl: string | null; name: string; bgColor: string }) {
  return imageUrl ? (
    <Image
      src={imageUrl}
      alt={name}
      fill
      className="object-cover transition-transform duration-500 group-hover:scale-105"
      sizes="(min-width: 1536px) 15vw, (min-width: 1024px) 22vw, (min-width: 640px) 40vw, 48vw"
    />
  ) : (
    <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: bgColor }}>
      <span className="select-none text-4xl font-black text-white/15">
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

function ProductCardBadges({ hasDiscount, discountPercent, isSoldOut, isBestSeller }: { hasDiscount: boolean; discountPercent: number; isSoldOut: boolean; isBestSeller: boolean }) {
  const t = useTranslations();
  return (
    <>
      {isBestSeller && !isSoldOut && (
        <motion.span
          className="flex gap-1 absolute right-2.5 top-2.5 overflow-hidden rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 shadow-[0_0_10px_2px_rgba(251,191,36,0.55)]"
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 18, delay: 0.1 }}
        >
          {/* shimmer sweep */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 -skew-x-[20deg] bg-gradient-to-r from-transparent via-white/50 to-transparent"
            animate={{ x: ["-120%", "220%"] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut", repeatDelay: 2 }}
          />
          {/* glow pulse ring */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-amber-300/70"
            animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.06, 1] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          />
          <StarIcon className="size-3.5 text-amber-900" />
          <span className="relative"> {t("bestseller")}</span>
        </motion.span>
      )}
      {hasDiscount && !isSoldOut && (
        <span className="absolute left-2.5 top-2.5 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
          -{discountPercent}%
        </span>
      )}
      {isSoldOut && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[2px]">
          <span className="rounded-full border border-white/25 bg-black/55 px-3 py-1 text-[11px] font-semibold tracking-wide text-white">
            {t("sold_out")}
          </span>
        </div>
      )}
    </>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-black/[0.06] bg-white">
      <div className="aspect-[4/3] animate-pulse bg-surface-card" />
      <div className="flex flex-1 flex-col space-y-2 px-3 pb-3.5 pt-2.5 sm:px-4">
        <div className="h-2.5 w-2/5 animate-pulse rounded-full bg-surface-card" />
        <div className="h-4 w-3/4 animate-pulse rounded-md bg-surface-card" />
        <div className="mt-auto h-4 w-1/3 animate-pulse rounded-md bg-surface-card" />
      </div>
    </div>
  );
}
