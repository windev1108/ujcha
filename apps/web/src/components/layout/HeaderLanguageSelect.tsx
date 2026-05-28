"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import Image from "next/image";
import enFlag from "@/assets/images/en.svg";
import vnFlag from "@/assets/images/vn.svg";

const LOCALE_COOKIE = "NEXT_LOCALE";
type Locale = "en" | "vi";

function localeFromPath(pathname: string): Locale {
  const seg = pathname.split("/").filter(Boolean)[0];
  return seg === "en" || seg === "vi" ? seg : "vi";
}

function pathWithLocale(pathname: string, next: Locale): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return `/${next}`;
  if (parts[0] === "en" || parts[0] === "vi") {
    parts[0] = next;
    return `/${parts.join("/")}`;
  }
  return `/${next}${pathname === "/" ? "" : pathname}`;
}

const FLAGS: Record<Locale, { src: typeof vnFlag; alt: string }> = {
  vi: { src: vnFlag, alt: "Tiếng Việt" },
  en: { src: enFlag, alt: "English" },
};

export function HeaderLanguageSelect() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useMemo(() => localeFromPath(pathname), [pathname]);

  function toggle() {
    const next: Locale = locale === "vi" ? "en" : "vi";
    const base = pathWithLocale(pathname, next);
    const qs = searchParams.toString();
    const href = qs ? `${base}?${qs}` : base;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.replace(href);
    router.refresh();
  }

  const { src, alt } = FLAGS[locale];

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Đổi ngôn ngữ"
      className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-black/[0.05] active:bg-black/[0.08]"
    >
      <span className="overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]">
        <Image
          src={src}
          alt={alt}
          width={22}
          height={15}
          unoptimized
          className="block"
        />
      </span>
    </button>
  );
}
