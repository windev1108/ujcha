"use client";

import { ROUTES } from "@/lib/routes";

type StringRouteKey = {
  [K in keyof typeof ROUTES]: (typeof ROUTES)[K] extends string ? K : never;
}[keyof typeof ROUTES];

/** Trả về đường dẫn từ ROUTES (không có locale prefix). */
export function useLocalizedHref() {
  const route = (key: StringRouteKey) => ROUTES[key] as string;
  return { route };
}
