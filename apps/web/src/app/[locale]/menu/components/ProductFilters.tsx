"use client";

import { useCategoriesQuery } from "@/services/category/hooks";
import { AnimatePresence, motion } from "motion/react";
import { easeOutSmooth } from "@/app/[locale]/(landing)/components/RevealSection";
import { Plus, Search, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Tooltip } from "@heroui/react";
import { OverflowPills } from "@/components/common/OverflowPills";

type Props = {
  activeCategory: string;
  onCategoryChange: (slug: string) => void;
  search: string;
  onSearchChange: (q: string) => void;
};

const PILL_GAP = 6; // gap-1.5
const PLUS_WIDTH = 32; // size-8

const pillClass = (active: boolean) =>
  `shrink-0 xl:max-w-[210px]  lg:max-w-[150px]  max-w-[120px] truncate rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${active
    ? "bg-kun-products-forest text-white shadow-sm"
    : "bg-kun-filter-pill-bg text-foreground/80 hover:bg-black/[0.07]"
  }`;

function TruncatedButton({
  label,
  className,
  onClick,
  triggerClassName,
}: {
  label: string;
  className: string;
  onClick: () => void;
  triggerClassName?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [truncated, setTruncated] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setTruncated(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [label]);

  return (
    <Tooltip delay={0.1} isDisabled={!truncated}>
      <Tooltip.Content>{label}</Tooltip.Content>
      <Tooltip.Trigger className={triggerClassName}>
        <button ref={ref} type="button" onClick={onClick} className={className}>
          {label}
        </button>
      </Tooltip.Trigger>
    </Tooltip>
  );
}

export function ProductFilters({ activeCategory, onCategoryChange, search, onSearchChange }: Props) {
  const t = useTranslations();
  const { data: categories } = useCategoriesQuery();
  const [showSearch, setShowSearch] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);


  const allLabel = t("all");
  const items = useMemo(
    () => [
      { id: "", label: t("all") },
      ...(categories ?? []).map((c) => ({ id: c.slug, label: c.name })),
    ],
    [categories, t],
  );

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
        <OverflowPills
          items={items}
          activeId={activeCategory}
          onSelect={onCategoryChange}
          moreLabel="Xem thêm danh mục"
          pillClass={(a) =>
            `rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${a ? "bg-kun-products-forest text-white shadow-sm" : "bg-kun-filter-pill-bg text-foreground/80 hover:bg-black/[0.07]"
            }`
          }
          plusClass={(a) =>
            a
              ? "bg-kun-products-forest text-white shadow-sm"
              : "bg-kun-filter-pill-bg text-foreground/60 hover:bg-black/[0.07] hover:text-foreground"
          }
          itemClass={(a) =>
            `text-[13px] font-medium ${a ? "bg-kun-products-forest/10 text-kun-products-forest" : "text-foreground/70 hover:bg-black/5"}`
          }
        />

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