"use client";

import { Card } from "@heroui/react";
import { motion } from "motion/react";
import { Banknote, QrCode } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { revealTransition } from "@/app/[locale]/(landing)/components/RevealSection";
import type { PaymentMethod } from "./checkout-types";

type Props = {
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
};

type MethodDef = { id: PaymentMethod; labelKey: string; descriptionKey: string; Icon: LucideIcon };

const methodDefs: MethodDef[] = [
  {
    id: "cash",
    labelKey: "cash",
    descriptionKey: "cash_desc",
    Icon: Banknote,
  },
  {
    id: "bank_transfer",
    labelKey: "bank_transfer",
    descriptionKey: "bank_transfer_desc",
    Icon: QrCode,
  },
];

export function PaymentMethodSection({ selected, onSelect }: Props) {
  const t = useTranslations();

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...revealTransition, delay: 0.1 }}
      className="mt-6 sm:mt-8"
    >
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
        {t("payment")}
      </p>
      <h2 className="mb-4 text-lg font-semibold text-foreground sm:text-xl">
        {t("payment_method")}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {methodDefs.map(({ id, labelKey, descriptionKey, Icon }) => {
          const active = selected === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className="text-left"
            >
              <Card
                className={`rounded-3xl border-2 p-4 transition-colors sm:p-5 ${active
                  ? "border-kun-products-forest bg-kun-mint/15"
                  : "border-transparent bg-kun-filter-pill-bg ring-1 ring-black/6"
                  }`}
              >
                <div className="flex items-start gap-3">
                  <Icon
                    className={`mt-0.5 size-5 shrink-0 ${active ? "text-kun-products-forest" : "text-foreground/50"}`}
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${active ? "text-kun-products-forest" : "text-foreground/80"}`}>
                      {t(labelKey)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-foreground/55 leading-snug">
                      {t(descriptionKey)}
                    </p>
                  </div>
                </div>
              </Card>
            </button>
          );
        })}
      </div>

      {selected === "bank_transfer" && (
        <p className="mt-3 text-xs text-foreground/55 text-center">
          {t("qr_info")}
        </p>
      )}
    </motion.section>
  );
}
