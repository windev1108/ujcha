"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

const LOCALE_COOKIE = "NEXT_LOCALE";
type Locale = "en" | "vi";

export function HeaderLanguageSelect() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      role="group"
      aria-label="Chọn ngôn ngữ"
      className="flex items-center rounded-full border border-black/10 bg-[#f0f0f0] p-0.5"
    >
      {(["vi", "en"] as Locale[]).map((lang) => {
        const active = locale === lang;
        return (
          <button
            key={lang}
            type="button"
            onClick={() => switchTo(lang)}
            aria-pressed={active}
            disabled={isPending}
            className={[
              "cursor-pointer rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide transition-all duration-150",
              active
                ? "bg-[#1a3c34] text-white shadow-sm"
                : "text-[#717171] hover:text-[#1a1a1a]",
            ].join(" ")}
          >
            {lang}
          </button>
        );
      })}
    </div>
  );
}
