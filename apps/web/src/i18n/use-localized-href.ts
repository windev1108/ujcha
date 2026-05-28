"use client";

import { useLocale } from "next-intl";

import { ROUTES } from "@/lib/routes";

import { getPathname } from "./navigation";

type StringRouteKey = {
  [K in keyof typeof ROUTES]: (typeof ROUTES)[K] extends string ? K : never;
}[keyof typeof ROUTES];

/** Đường dẫn đầy đủ có prefix locale (vd. `/vi/payments`) cho ROUTES. */
export function useLocalizedHref() {
  const locale = useLocale();
  const route = (key: StringRouteKey) =>
    getPathname({ href: ROUTES[key] as string, locale });
  return { route };
}
