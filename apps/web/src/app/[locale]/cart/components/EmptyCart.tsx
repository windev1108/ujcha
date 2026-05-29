"use client";

import { motion } from "motion/react";
import { ShoppingBag } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { revealTransition } from "@/app/[locale]/(landing)/components/RevealSection";
import { ROUTES } from "@/lib/routes";
import { useTranslations } from "next-intl";

export function EmptyCart() {
  const t = useTranslations();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={revealTransition}
      className="flex min-h-[min(70vh,560px)] flex-col items-center justify-center px-4 py-16 text-center"
    >
      <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-surface-secondary">
        <ShoppingBag className="size-8 stroke-[1.5] text-muted" aria-hidden />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {t("cart_empty")}
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-foreground/70 sm:text-base">
        {t("cart_empty_desc")}
      </p>
      <Link
        href={ROUTES.PRODUCTS}
        className="mt-8 inline-flex rounded-full bg-kun-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
      >
        {t("view_menu")}
      </Link>
    </motion.div>
  );
}
