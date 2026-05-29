import { defineRouting } from 'next-intl/routing';
import { defaultLocale, locales } from './config';


export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "never",
  // localeDetection defaults to true: reads NEXT_LOCALE cookie first, then Accept-Language
});