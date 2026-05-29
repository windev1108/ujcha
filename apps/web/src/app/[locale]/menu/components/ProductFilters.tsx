"use client";

import { useCategoriesQuery } from "@/services/category/hooks";
import { AnimatePresence, motion } from "motion/react";
import { easeOutSmooth } from "@/app/[locale]/(landing)/components/RevealSection";
import { Search, X } from "lucide-react";
import { useRef, useState } from "react";
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
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex gap-1.5 flex-nowrap pb-px">
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
