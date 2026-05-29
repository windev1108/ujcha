"use client";

import { Suspense, useState } from "react";
import { ROUTES } from "@/lib/routes";
import { Header } from "@heroui/react";
import { HeaderLanguageSelect } from "./HeaderLanguageSelect";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserProfile } from "../common/UserProfile";
import { CartSection } from "../common/CartSection";
import SearchSection from "../common/SearchSection";
import { Logo } from "../common/Logo";
import { Bell, Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks";
import { motion, AnimatePresence } from "motion/react";

export function AppHeader() {
  const pathname = usePathname();
  const t = useTranslations();
  const { isLoggedIn, isHydrated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const NAV: readonly { href: string; label: string; badge?: string }[] = [
    { href: ROUTES.PRODUCTS, label: t("menu") },
    { href: ROUTES.PROMOTIONS, label: t("promotions") },
    { href: ROUTES.GROUP_ORDERS, label: t("group_orders") },
    { href: ROUTES.REFERRAL, label: t("referral_and_earn") },
    { href: ROUTES.BLOG, label: t("blog") },
    { href: ROUTES.ABOUT, label: t("about") },
  ] as const;

  return (
    <>
      <Header className="sticky top-0 z-50 w-full border-b border-black/[0.06] bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
        <div className="container flex h-12 items-center justify-between gap-2 sm:h-14 sm:gap-3">
          {/* Logo */}
          <Link href={ROUTES.HOME} className="flex shrink-0 items-center outline-offset-4">
            <Logo size="sm" className="h-10 w-auto" />
          </Link>

          {/* Desktop nav */}
          <nav
            className="hidden flex-1 items-center justify-center gap-0.5 md:flex"
            aria-label="Điều hướng chính"
          >
            {NAV.map((item) => {
              const isActive = pathname.includes(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${isActive
                    ? "bg-kun-primary/[0.07] text-kun-primary"
                    : "text-foreground/60 hover:bg-black/[0.04] hover:text-foreground"
                    }`}
                >
                  {item.label}
                  {item.badge && (
                    <span className="rounded-full bg-kun-primary px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-wide text-white">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1 sm:gap-4">
            <SearchSection />

            {/* Lang + Bell — desktop only */}
            <div className="hidden items-center gap-1.5 md:flex">
              <Suspense fallback={<div className="w-[58px] h-7 shrink-0" aria-hidden />}>
                <HeaderLanguageSelect />
              </Suspense>

              {!isHydrated ? (
                <div className="size-8 shrink-0" aria-hidden />
              ) : isLoggedIn ? (
                <Link
                  href={ROUTES.NOTIFICATIONS}
                  aria-label="Thông báo"
                  className="flex size-8 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-black/[0.05] hover:text-foreground"
                >
                  <Bell className="size-[18px]" />
                </Link>
              ) : null}
            </div>

            {isLoggedIn && <CartSection />}

            {/* UserProfile — desktop only */}
            <div className="hidden md:block">
              <UserProfile />
            </div>

            {/* Hamburger — mobile only */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Mở menu điều hướng"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-black/[0.05] hover:text-foreground md:hidden"
            >
              <Menu className="size-5" />
            </button>
          </div>
        </div>
      </Header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
              onClick={() => setMenuOpen(false)}
            />

            {/* Bottom sheet */}
            <motion.div
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-50 overflow-hidden rounded-t-[28px] bg-white shadow-2xl md:hidden"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3">
                <div className="h-1 w-10 rounded-full bg-black/10" />
              </div>

              {/* Sheet header */}
              <div className="flex items-center justify-between px-5 pb-2 pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Điều hướng</p>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="flex size-8 items-center justify-center rounded-full bg-surface-card text-foreground/60 transition-colors hover:bg-surface-tertiary"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Nav links */}
              <nav className="px-3 pb-3">
                {NAV.map((item, i) => {
                  const isActive = pathname.includes(item.href);
                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className={`flex items-center justify-between rounded-2xl px-4 py-3.5 text-[15px] font-semibold transition-colors ${isActive
                          ? "bg-kun-primary/[0.07] text-kun-primary"
                          : "text-foreground hover:bg-surface-soft"
                          }`}
                      >
                        <span>{item.label}</span>
                        {isActive && <span className="size-1.5 rounded-full bg-kun-primary" />}
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>

              {/* Mobile footer: lang switch + account */}
              <div className="flex items-center justify-between border-t border-black/[0.06] px-5 py-3">
                <Suspense fallback={<div className="w-[58px] h-7 shrink-0" aria-hidden />}>
                  <HeaderLanguageSelect />
                </Suspense>
                <div className="flex items-center gap-2">
                  {isLoggedIn && (
                    <Link
                      href={ROUTES.NOTIFICATIONS}
                      aria-label="Thông báo"
                      onClick={() => setMenuOpen(false)}
                      className="flex size-8 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-black/[0.05] hover:text-foreground"
                    >
                      <Bell className="size-[18px]" />
                    </Link>
                  )}
                  <UserProfile onNavigate={() => setMenuOpen(false)} />
                </div>
              </div>

              {/* Safe-area spacer for iOS home indicator */}
              <div className="h-[max(env(safe-area-inset-bottom),16px)]" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
