"use client";

import { Tab, Tabs } from "@heroui/react";
import { motion } from "motion/react";
import type { Key } from "react";
import { useTranslations } from "next-intl";
import {
  CHECKOUT_TAB,
  CHECKOUT_TAB_OPTIONS,
  type CheckoutTabId,
} from "./checkout-tab";
import { revealTransition } from "@/app/[locale]/(landing)/components/RevealSection";

type Props = {
  tab: CheckoutTabId;
  onTabChange: (tab: CheckoutTabId) => void;
};

function CheckoutHeader({ tab, onTabChange }: Props) {
  const t = useTranslations();

  function subtitleFor(tab: CheckoutTabId) {
    switch (tab) {
      case CHECKOUT_TAB.DELIVERY:
        return t("delivery_subtitle");
      case CHECKOUT_TAB.PICKUP:
        return t("pickup_subtitle");
      case CHECKOUT_TAB.TABLE:
        return t("table_subtitle");
      default:
        return "";
    }
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={revealTransition}
      className="mb-8 space-y-5 sm:mb-10"
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          {t("order_eyebrow")}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t("payment")}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground/65">
          {subtitleFor(tab)}
        </p>
      </div>

      {/* Tab switcher — full width, 44px touch targets */}
      <Tabs
        selectedKey={tab}
        onSelectionChange={(key: Key) => onTabChange(key as CheckoutTabId)}
        className="w-full sm:max-w-sm"
      >
        <Tabs.List
          aria-label={t("delivery_type")}
          className="grid w-full grid-cols-2 gap-1 rounded-full border border-black/8 bg-kun-filter-pill-bg p-1"
        >
          {CHECKOUT_TAB_OPTIONS.map((opt) => (
            <Tab
              key={opt.id}
              id={opt.id}
              className="h-auto! w-full! rounded-full px-3 py-2.5 text-center text-sm font-semibold text-foreground/60 transition-colors data-[selected=true]:bg-white data-[selected=true]:text-kun-products-forest data-[selected=true]:shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
            >
              {t(opt.labelKey)}
            </Tab>
          ))}
        </Tabs.List>
      </Tabs>
    </motion.header>
  );
}

export { CheckoutHeader };
