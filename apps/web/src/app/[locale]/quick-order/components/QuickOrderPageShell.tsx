"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import type { CategoryId, QuickProduct } from "./quick-order-data";
import { QUICK_ORDER_PRODUCTS } from "./quick-order-data";
import { QuickOrderCategoryTabs } from "./QuickOrderCategoryTabs";
import { QuickOrderFloatingBar } from "./QuickOrderFloatingBar";
import { QuickOrderGrid } from "./QuickOrderGrid";
import { QuickOrderHeader } from "./QuickOrderHeader";
import { revealTransition } from "@/app/[locale]/(landing)/components/RevealSection";

export function QuickOrderPageShell() {
  const [category, setCategory] = useState<CategoryId>("matcha");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const { itemCount, total } = useMemo(() => {
    let count = 0;
    let sum = 0;
    for (const [id, qty] of Object.entries(quantities)) {
      if (qty <= 0) continue;
      count += qty;
      const p = QUICK_ORDER_PRODUCTS.find((x: QuickProduct) => x.id === id);
      if (p) sum += p.price * qty;
    }
    return { itemCount: count, total: sum };
  }, [quantities]);

  function addProduct(product: QuickProduct) {
    setQuantities((prev) => ({
      ...prev,
      [product.id]: (prev[product.id] ?? 0) + 1,
    }));
  }

  return (
    <div className="min-h-screen bg-surface-soft pb-32 pt-8 sm:pb-36 sm:pt-10 lg:pt-12">
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={revealTransition}
        className="container mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 xl:px-12"
      >
        <QuickOrderHeader />
        <QuickOrderCategoryTabs selected={category} onChange={setCategory} />
        <QuickOrderGrid categoryId={category} onAdd={addProduct} />
      </motion.main>

      <QuickOrderFloatingBar itemCount={itemCount} total={total} />
    </div>
  );
}
