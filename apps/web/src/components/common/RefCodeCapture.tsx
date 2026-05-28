"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export const REF_CODE_KEY = "kun_ref_code";

export function RefCodeCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref && ref.trim()) {
      sessionStorage.setItem(REF_CODE_KEY, ref.trim().toUpperCase());
    }
  }, [searchParams]);

  return null;
}

export function getStoredRefCode(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(REF_CODE_KEY);
}

export function clearStoredRefCode(): void {
  if (typeof window !== "undefined") sessionStorage.removeItem(REF_CODE_KEY);
}
