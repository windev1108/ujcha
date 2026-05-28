"use client";

import { Tab, Tabs } from "@heroui/react";
import { motion } from "motion/react";
import type { Key } from "react";
import type { CategoryId } from "./quick-order-data";
import { QUICK_ORDER_CATEGORIES } from "./quick-order-data";
import { revealTransition } from "@/app/[locale]/(landing)/components/RevealSection";

type Props = {
  selected: CategoryId;
  onChange: (id: CategoryId) => void;
};

export function QuickOrderCategoryTabs({ selected, onChange }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...revealTransition, delay: 0.06 }}
      className="-mx-4 mb-10 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:mb-11 lg:overflow-x-visible lg:px-0"
    >
      {/*
        Ghi đè HeroUI: .tabs__list { w-full } + .tabs__tab { w-full } để không full màn hình.
      */}
      <Tabs
        selectedKey={selected}
        onSelectionChange={(key: Key) => onChange(key as CategoryId)}
        className="w-max max-w-full"
      >
        <Tabs.List
          aria-label="Danh mục món"
          className="inline-flex! w-max! max-w-full flex-nowrap gap-2 rounded-full bg-surface-card p-1.5 ring-1 ring-black/5"
        >
          {QUICK_ORDER_CATEGORIES.map((cat) => (
            <Tab
              key={cat.id}
              id={cat.id}
              className="h-auto! w-auto! shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold whitespace-nowrap text-foreground/70 transition-[color,background,box-shadow] duration-200 data-[selected=true]:bg-kun-products-forest data-[selected=true]:text-white data-[selected=true]:shadow-[0_2px_8px_-2px_rgba(38,99,77,0.45)] data-[hover-unselected=true]:bg-white/60"
            >
              {cat.label}
            </Tab>
          ))}
        </Tabs.List>
      </Tabs>
    </motion.div>
  );
}
