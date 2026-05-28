"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";

/** easeOut gần giống cubic-bezier(0.25, 0.1, 0.25, 1) — chuyển động mượt */
export const easeOutSmooth: [number, number, number, number] = [
  0.25, 0.1, 0.25, 1,
];

export const revealTransition = {
  duration: 0.8,
  ease: easeOutSmooth,
} as const;

type RevealSectionProps = HTMLMotionProps<"section"> & {
  children: ReactNode;
  delay?: number;
};
export function RevealSection({
  children,
  className,
  delay = 0,
  ...rest
}: RevealSectionProps) {
  return (
    <motion.section
      className={className}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-32px" }}
      transition={{ ...revealTransition, delay }}
      {...rest}
    >
      <>
        {children}
      </>
    </motion.section>
  );
}
