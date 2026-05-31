"use client";

import { useCategoriesQuery } from "@/services/category/hooks";
import { AnimatePresence, motion } from "motion/react";
import { easeOutSmooth } from "@/app/[locale]/(landing)/components/RevealSection";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

type Props = {
  activeCategory: string;
  onCategoryChange: (slug: string) => void;
  search: string;
  onSearchChange: (q: string) => void;
};

export function ProductFilters({ activeCategory, onCategoryChange, search, onSearchChange }: Props) {
  const t = useTranslations();
  const { data: categories } = useCategoriesQuery();
  const [showSearch, setShowSearch] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  const [fadeLeft, setFadeLeft] = useState(false);
  const [fadeRight, setFadeRight] = useState(false);

  const syncFade = () => {
    const el = pillsRef.current;
    if (!el) return;
    setFadeLeft(el.scrollLeft > 1);
    setFadeRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    const el = pillsRef.current;
    if (!el) return;
    syncFade();
    el.addEventListener("scroll", syncFade, { passive: true });
    const ro = new ResizeObserver(syncFade);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", syncFade); ro.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { syncFade(); }, [categories]);

  const openSearch = () => {
    setShowSearch(true);
    setTimeout(() => inputRef.current?.focus(), 40);
  };

  const closeSearch = () => {
    setShowSearch(false);
    onSearchChange("");
  };

  return (
    <div className="space-y-2">
      {/* Row 1: category pills + search toggle */}
      <div className="flex items-center gap-2">
        {/* Horizontal-scroll pills */}
        <div className="relative min-w-0 flex-1">
          {/* Left fade + arrow */}
          {fadeLeft && (
            <>
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-white to-transparent" />
              <button
                type="button"
                aria-label="Cuộn trái"
                onClick={() => pillsRef.current?.scrollBy({ left: -180, behavior: "smooth" })}
                className="absolute left-0 top-1/2 z-20 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white shadow-sm transition-colors hover:bg-black/[0.04]"
              >
                <ChevronLeft className="size-3.5 text-foreground/55" />
              </button>
            </>
          )}

          <div
            ref={pillsRef}
            className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex w-max min-w-full items-center gap-1.5 pb-px">
              <button
                type="button"
                onClick={() => onCategoryChange("")}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${activeCategory === ""
                    ? "bg-kun-products-forest text-white shadow-sm"
                    : "bg-kun-filter-pill-bg text-foreground/80 hover:bg-black/[0.07]"
                  }`}
              >
                {t("all")}
              </button>
              {categories?.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onCategoryChange(cat.slug)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${activeCategory === cat.slug
                      ? "bg-kun-products-forest text-white shadow-sm"
                      : "bg-kun-filter-pill-bg text-foreground/80 hover:bg-black/[0.07]"
                    }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Right fade + arrow */}
          {fadeRight && (
            <>
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-white to-transparent" />
              <button
                type="button"
                aria-label="Cuộn phải"
                onClick={() => pillsRef.current?.scrollBy({ left: 180, behavior: "smooth" })}
                className="absolute right-0 top-1/2 z-20 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white shadow-sm transition-colors hover:bg-black/[0.04]"
              >
                <ChevronRight className="size-3.5 text-foreground/55" />
              </button>
            </>
          )}
        </div>

        {/* Vertical divider */}
        <div className="h-5 w-px shrink-0 bg-black/10" />

        {/* Search icon toggle */}
        <button
          type="button"
          onClick={showSearch ? closeSearch : openSearch}
          aria-label={showSearch ? t("close") : t("search_product")}
          className={`cursor-pointer flex size-8 shrink-0 items-center justify-center rounded-full transition-colors ${showSearch || search
              ? "bg-kun-products-forest text-white"
              : "bg-kun-filter-pill-bg text-foreground/60 hover:bg-black/[0.07] hover:text-foreground"
            }`}
        >
          {showSearch ? <X className="size-3.5" /> : <Search className="size-3.5" />}
        </button>
      </div>

      {/* Row 2: search input (slides in/out) */}
      <AnimatePresence initial={false}>
        {showSearch && (
          <motion.div
            key="search-row"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: easeOutSmooth }}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={t("search_product")}
                className="h-9 w-full rounded-full border border-black/8 bg-surface-soft pl-9 pr-9 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-kun-primary/25 focus:border-transparent"
                maxLength={80}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
