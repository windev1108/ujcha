"use client";

import { motion } from "motion/react";
import { Leaf } from "lucide-react";

export function ProductPageIntro() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#1a3c34] via-[#1e4438] to-[#112a21] pb-20 pt-16 sm:pb-24 sm:pt-20">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-24 -top-24 size-72 rounded-full bg-white/[0.03] blur-3xl" />
        <div className="absolute -bottom-16 left-1/4 size-96 rounded-full bg-[#99d6b3]/[0.06] blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "40px 40px" }}
        />
      </div>

      <div className="relative container mx-auto max-w-[72rem] px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
            <Leaf className="size-7 text-white" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
            Thực đơn · UjCha
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Thực đơn của UjCha
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-white/60"
          >
            Matcha, cà phê, trà và đồ uống — nguồn gốc bền vững, chất lượng ceremonial.
          </motion.p>
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 40" fill="none" className="w-full">
          <path d="M0 40 C360 0 1080 0 1440 40 L1440 40 L0 40Z" fill="white" />
        </svg>
      </div>
    </section>
  );
}
