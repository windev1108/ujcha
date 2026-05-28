"use client";

import { motion, useReducedMotion } from "motion/react";
import { LoginFormCard } from "./LoginFormCard";
import { easeOutSmooth, revealTransition } from "@/components/common/RevealSection";


export function LoginPageShell() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-4 py-8 sm:px-6 sm:py-10 md:py-14">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(113,179,148,0.08),transparent_55%),radial-gradient(ellipse_at_80%_80%,rgba(26,60,52,0.04),transparent_45%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[#f4f4f5]"
        aria-hidden
      />

      <motion.div
        className="relative z-10 w-full max-w-[min(100%,32rem)]"
        initial={
          reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }
        }
        animate={{ opacity: 1, y: 0 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { ...revealTransition, ease: easeOutSmooth }
        }
      >
        <LoginFormCard />
      </motion.div>
    </div>
  );
}
