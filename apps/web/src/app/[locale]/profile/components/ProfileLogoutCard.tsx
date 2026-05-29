"use client";

import { Card, CardContent } from "@heroui/react";
import { ChevronRight, LogOut } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

type Props = {
  onLogout: () => void;
};

export function ProfileLogoutCard({ onLogout }: Props) {
  const t = useTranslations();
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-32px" }}
      transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1], delay: 0.06 }}
    >
      <button
        type="button"
        onClick={onLogout}
        className="block cursor-pointer w-full rounded-3xl border border-red-100 hover:bg-red-100/60 bg-red-50/90 text-left outline-offset-2 transition-colors focus-visible:ring-2 focus-visible:ring-red-200"
      >
        <Card className="rounded-3xl border-0 bg-transparent shadow-none">
          <CardContent className="flex flex-row items-center gap-4 p-4 sm:p-5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-red-100/80">
              <LogOut className="size-5 text-red-600" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-red-600">{t("logout")}</p>
              <p className="mt-0.5 text-xs text-red-500/90">{t("see_you_soon")}</p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-red-400" />
          </CardContent>
        </Card>
      </button>
    </motion.div>
  );
}
