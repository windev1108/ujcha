"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import type { CategoryId, QuickProduct } from "./quick-order-data";
import { QUICK_ORDER_PRODUCTS } from "./quick-order-data";
import { QuickOrderProductCard } from "./QuickOrderProductCard";
import { easeOutSmooth } from "@/app/[locale]/(landing)/components/RevealSection";

type Props = {
  categoryId: CategoryId;
  onAdd: (product: QuickProduct) => void;
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: easeOutSmooth },
  },
};

export function QuickOrderGrid({ categoryId, onAdd }: Props) {
  const t = useTranslations();
  const items = QUICK_ORDER_PRODUCTS.filter((p) => p.categoryId === categoryId);

  if (items.length === 0) {
    return (
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[28px] border border-dashed border-black/12 bg-white/70 px-8 py-16 text-center text-sm text-foreground/55"
      >
        {t("category_updating")}
      </motion.p>
    );
  }

  return (
    <motion.div
      key={categoryId}
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 gap-5 min-[440px]:grid-cols-2 min-[440px]:gap-5 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4 xl:gap-7"
    >
      {items.map((product) => (
        <motion.div key={product.id} variants={item} layout>
          <QuickOrderProductCard product={product} onAdd={() => onAdd(product)} />
        </motion.div>
      ))}
    </motion.div>
  );
}
