"use client";

import { Button } from "@heroui/react";
import { motion } from "motion/react";
import type { RitualItem } from "./product-detail-data";
import { revealTransition } from "@/app/[locale]/(landing)/components/RevealSection";
import { ProductItemCard } from "@/components/common/ProductItemCard";

type Props = {
  items: RitualItem[];
};

export function PerfectRitualSection({ items }: Props) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={revealTransition}
      className="space-y-6"
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-semibold text-foreground">The Perfect Ritual</h2>
          <p className="mt-2 text-foreground/70">
            Elevate your preparation with traditional tools.
          </p>
        </div>
        <Button
          variant="ghost"
          className="hidden rounded-full px-1 text-sm text-kun-products-forest md:inline-flex"
        >
          View Brewing Guide
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <ProductItemCard
            key={item.id}
            title={item.title}
            description={item.description}
            price={item.price}
            image={item.image}
          />
        ))}
      </div>
    </motion.section>
  );
}
