"use client";

import { FEATURED_RITUAL } from "./products-data";
import { Link } from "@heroui/react";
import { motion } from "motion/react";
import Image from "next/image";
import type { SVGProps } from "react";
import { revealTransition } from "@/app/[locale]/(landing)/components/RevealSection";
import { useTranslations } from "next-intl";

function SparkleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 2l1.2 4.2L18 8l-4.8 1.8L12 14l-1.2-4.2L6 8l4.8-1.8L12 2zm7 9l.8 2.8L22 15l-3.2 1.2L16 20l-1.2-3.2L12 16l3.2-1.2L19 11zm-14 0l1.2 3.2L8 16l-3.2 1.2L4 20l-1.2-4.2L0 15l3.2-1.2L5 11z" />
    </svg>
  );
}

export function FeaturedRitualCard() {
  const t = useTranslations();
  return (
    <motion.div
      className="relative min-h-[360px] overflow-hidden rounded-2xl ring-1 ring-black/[0.06] sm:min-h-[420px] lg:min-h-0 lg:h-full"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-48px" }}
      transition={{ ...revealTransition, delay: 0.08 }}
    >
      <Image
        src={FEATURED_RITUAL.image}
        alt={FEATURED_RITUAL.title}
        fill
        className="object-cover"
        sizes="(min-width: 1024px) 50vw, 100vw"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/85 sm:text-[11px]">
          {FEATURED_RITUAL.eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
          {FEATURED_RITUAL.title}
        </h2>
        <div className="mt-5">
          <Link
            href={FEATURED_RITUAL.href}
            className="inline-flex rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-kun-products-forest shadow-sm transition hover:opacity-95"
          >
            {t("explore_collection")}
          </Link>
        </div>
      </div>
      <button
        type="button"
        aria-label={t("ritual_suggestion")}
        className="absolute bottom-6 right-6 flex size-12 items-center justify-center rounded-full bg-kun-products-forest text-white shadow-lg transition hover:opacity-95 sm:bottom-8 sm:right-8"
      >
        <SparkleIcon className="size-5" />
      </button>
    </motion.div>
  );
}
