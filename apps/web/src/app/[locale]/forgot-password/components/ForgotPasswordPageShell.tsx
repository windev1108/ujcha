"use client";

import { Suspense } from "react";
import { ForgotPasswordFormCard } from "./ForgotPasswordFormCard";

export function ForgotPasswordPageShell() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordFormCard />
    </Suspense>
  );
}
