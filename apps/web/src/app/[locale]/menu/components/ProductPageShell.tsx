"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import { ProductFilters } from "./ProductFilters";
import { ProductGrid } from "./ProductGrid";
import { ProductPageIntro } from "./ProductPageIntro";

function Shell() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") ?? "";
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setActiveCategory(searchParams.get("category") ?? "");
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-surface-soft">
      {/* Full-bleed hero */}
      <ProductPageIntro />

      {/* Sticky filter bar */}
      <div className="sticky top-11 sm:top-12 z-30 border-b border-black/6 bg-white/95 backdrop-blur-sm">
        <div className="container py-2">
          <ProductFilters
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            search={search}
            onSearchChange={setSearch}
          />
        </div>
      </div>

      {/* Product grid */}
      <div className="container pb-20 pt-6">
        <ProductGrid categorySlug={activeCategory || undefined} search={search || undefined} />
      </div>
    </div>
  );
}

export function ProductPageShell() {
  return (
    <Suspense>
      <Shell />
    </Suspense>
  );
}
