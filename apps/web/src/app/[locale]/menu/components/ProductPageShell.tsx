"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { ProductFilters } from "./ProductFilters";
import { ProductGrid } from "./ProductGrid";
import { ProductPageIntro } from "./ProductPageIntro";

function Shell() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");

  const activeCategory = searchParams.get("category") ?? "";

  const handleCategoryChange = useCallback(
    (slug: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (slug) params.set("category", slug);
      else params.delete("category");

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="min-h-screen bg-surface-soft">
      <ProductPageIntro />

      <div className="sticky top-12 sm:top-16 z-30 border-b border-black/6 bg-white/95 backdrop-blur-sm">
        <div className="container py-2">
          <ProductFilters
            activeCategory={activeCategory}
            onCategoryChange={handleCategoryChange}
            search={search}
            onSearchChange={setSearch}
          />
        </div>
      </div>

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