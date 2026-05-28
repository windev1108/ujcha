"use client";

import { motion } from "motion/react";
import { UtensilsCrossed } from "lucide-react";
import { revealTransition } from "@/app/[locale]/(landing)/components/RevealSection";

const TABLE_NUMBER = "12";

export function QuickOrderHeader() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={revealTransition}
      className="mb-10 flex flex-col gap-8 lg:mb-12 lg:flex-row lg:items-start lg:justify-between lg:gap-10"
    >
      <div className="max-w-2xl">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-foreground/45 sm:text-xs">
          Chào mừng đến bàn {TABLE_NUMBER}
        </p>
        <h1 className="mt-3 text-3xl font-bold uppercase leading-[1.15] tracking-tight text-foreground sm:text-4xl lg:text-[2.35rem]">
          Đặt món nhanh tại bàn
        </h1>
      </div>

      <div className="flex max-w-md shrink-0 items-start gap-4 rounded-[28px] border border-black/[0.06] bg-white px-5 py-4 shadow-[0_10px_40px_-16px_rgba(0,0,0,0.18)] sm:items-center sm:px-6 sm:py-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-kun-products-forest text-white shadow-inner">
          <UtensilsCrossed className="size-[22px]" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold leading-snug text-foreground sm:text-[15px]">
            Đặt món nhanh ngay tại bàn
          </p>
          <p className="text-xs leading-relaxed text-foreground/55 sm:text-sm">
            Trải nghiệm số liền mạch — gọi món không cần chờ nhân viên.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
