"use client";

import type { ReactNode } from "react";

export function AuthSplitLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#f5f5f5] px-4 py-10">
      <div className="w-full max-w-[26rem] rounded-3xl border border-black/[0.06] bg-white p-8 shadow-[0_4px_32px_-8px_rgba(0,0,0,0.10)]">
        {children}
      </div>
    </div>
  );
}
