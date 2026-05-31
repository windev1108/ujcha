"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { X, Search } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useProductsQuery } from "@/services/product/hooks";
import type { ApiProduct } from "@/services/product/types";
import { useTranslations, useLocale } from "next-intl";
import { ROUTES } from "@/lib/routes";
import { getDisplayName } from "@/lib/product-name";

function normalizeVi(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function fmtPrice(p: string) {
  return Number(p).toLocaleString("vi-VN") + "đ";
}

export default function SearchSection() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const t = useTranslations()

  const { data: products } = useProductsQuery();

  const results = useMemo<ApiProduct[]>(() => {
    if (!query.trim() || !products) return [];
    const q = normalizeVi(query.trim());
    return products
      .filter(
        (p) =>
          normalizeVi(p.name).includes(q) ||
          normalizeVi(p.description ?? "").includes(q),
      )
      .slice(0, 7);
  }, [query, products]);

  // Close dropdown on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Esc closes everything
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setMobileOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Focus mobile input when overlay opens
  useEffect(() => {
    if (mobileOpen) {
      setTimeout(() => mobileInputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [mobileOpen]);

  function handleSelect(product: ApiProduct) {
    router.push(`${ROUTES.MENU}/${product.slug}`);
    setOpen(false);
    setMobileOpen(false);
    setQuery("");
  }

  function clearQuery() {
    setQuery("");
    inputRef.current?.focus();
  }

  const ResultList = ({ onSelect }: { onSelect: (p: ApiProduct) => void }) => {
    const locale = useLocale();
    return (
      <>
        {results.length === 0 ? (
          <p className="px-4 py-5 text-center text-sm text-foreground/45">
            Không tìm thấy sản phẩm nào
          </p>
        ) : (
          <ul>
            {results.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => onSelect(product)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-secondary"
                >
                  <div className="relative size-10 shrink-0 overflow-hidden rounded-xl ring-1 ring-black/6">
                    {product.imageUrls[0] ? (
                      <Image
                        src={product.imageUrls[0]}
                        alt={getDisplayName(product, locale)}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    ) : (
                      <div className="size-full bg-surface-secondary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {getDisplayName(product, locale)}
                    </p>
                    <p className="text-xs text-foreground/50">
                      {product.category.name} · {fmtPrice(product.price)}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  };

  return (
    <>
      {/* ── Desktop search ─────────────────────────────────── */}
      <div ref={containerRef} className="relative hidden sm:block">
        <div className="relative w-40 lg:w-52">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-foreground/35" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={t('search_product')}
            className="h-8 w-full rounded-full border-0 bg-surface-secondary py-1.5 pl-8 pr-7 text-sm text-foreground outline-none ring-1 ring-black/[0.06] placeholder:text-foreground/35 focus:ring-2 focus:ring-kun-products-forest/30 transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={clearQuery}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground/35 hover:text-foreground transition-colors"
              aria-label="Xoá"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {open && query.trim() && (
          <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-black/[0.07] bg-white shadow-[0_8px_32px_-8px_rgba(0,0,0,0.18)]">
            <ResultList onSelect={handleSelect} />
          </div>
        )}
      </div>

      {/* ── Mobile search icon ──────────────────────────────── */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Tìm kiếm"
        className="flex size-8 items-center justify-center rounded-full text-foreground/65 hover:text-foreground transition-colors sm:hidden"
      >
        <Search className="size-[18px]" />
      </button>

      {/* ── Mobile fullscreen overlay ───────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-white sm:hidden">
          {/* Top bar */}
          <div className="flex items-center gap-2 border-b border-black/[0.07] px-4 py-3">
            <Search className="size-4 shrink-0 text-foreground/40" />
            <input
              ref={mobileInputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm sản phẩm..."
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/40"
            />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="shrink-0 text-sm font-medium text-foreground/60 hover:text-foreground transition-colors"
            >
              Huỷ
            </button>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto">
            {query.trim() ? (
              <ResultList onSelect={handleSelect} />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Search className="size-8 text-foreground/15" />
                <p className="mt-3 text-sm text-foreground/40">
                  Nhập tên sản phẩm để tìm kiếm
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
