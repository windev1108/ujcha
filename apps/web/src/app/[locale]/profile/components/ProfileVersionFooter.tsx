"use client";

import { Text } from "@heroui/react";
import { motion } from "motion/react";

import { easeOutSmooth, revealTransition } from "@/app/[locale]/(landing)/components/RevealSection";

export function ProfileVersionFooter() {
  return (
    <motion.div
      className="mt-10 text-center"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ ...revealTransition, ease: easeOutSmooth, delay: 0.15 }}
    >
      <Text className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted/80 sm:text-[11px]">
        Version 2.4.0 · UjCha Beverage
      </Text>
    </motion.div>
  );
}
