"use client";

import { Badge, Button, Card, CardContent } from "@heroui/react";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import type { QuickProduct } from "./quick-order-data";
import { formatVnd } from "./quick-order-data";
import { getDisplayName } from "@/lib/product-name";
import { easeOutSmooth } from "@/app/[locale]/(landing)/components/RevealSection";

type Props = {
  product: QuickProduct;
  onAdd: () => void;
};

export function QuickOrderProductCard({ product, onAdd }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <motion.div
      layout
      whileHover={{ y: -6 }}
      transition={{ duration: 0.28, ease: easeOutSmooth }}
    >
      <Card className="group h-full overflow-hidden rounded-[28px] border-0 bg-white shadow-[0_4px_24px_-8px_rgba(0,0,0,0.1)] transition-shadow duration-300 hover:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.16)]">
        <CardContent className="flex h-full flex-col p-0">
          <div className="px-4 pt-4 sm:px-5 sm:pt-5">
            <div className="relative aspect-5/4 w-full overflow-hidden rounded-3xl bg-surface-card ring-1 ring-black/6">
              {product.badge === "best-seller" ? (
                <Badge
                  color="success"
                  variant="secondary"
                  size="sm"
                  className="absolute left-3 top-3 z-10 rounded-full border-0 bg-kun-mint/85 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-kun-products-forest backdrop-blur-[2px]"
                >
                  {t("bestseller")}
                </Badge>
              ) : null}
              {product.badge === "new" ? (
                <Badge
                  color="success"
                  variant="secondary"
                  size="sm"
                  className="absolute left-3 top-3 z-10 rounded-full border-0 bg-kun-mint/85 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-kun-products-forest backdrop-blur-[2px]"
                >
                  {t("new_arrival")}
                </Badge>
              ) : null}
              <Image
                src={product.image}
                alt={getDisplayName(product, locale)}
                fill
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 28vw, (min-width: 640px) 42vw, 50vw"
              />
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
            <div className="min-h-0 flex-1">
              <h3 className="text-[1.05rem] font-bold leading-snug tracking-tight text-foreground sm:text-lg">
                {getDisplayName(product, locale)}
              </h3>
              <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-foreground/55 sm:text-sm">
                {product.description}
              </p>
            </div>
            <div className="flex items-end justify-between gap-3 border-t border-black/5 pt-4">
              <p className="text-base font-bold tabular-nums tracking-tight text-foreground sm:text-[1.05rem]">
                {formatVnd(product.price)}
              </p>
              <Button
                isIconOnly
                variant="primary"
                aria-label={`${t("add_to_cart")} ${getDisplayName(product, locale)}`}
                className="size-12 shrink-0 rounded-full bg-kun-products-forest text-white shadow-[0_4px_14px_-4px_rgba(38,99,77,0.55)] hover:opacity-95"
                onPress={onAdd}
              >
                <Plus className="size-[22px] stroke-[2.75]" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
