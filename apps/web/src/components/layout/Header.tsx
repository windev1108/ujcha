"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { ROUTES } from "@/lib/routes";
import { Header } from "@heroui/react";
import { HeaderLanguageSelect } from "./HeaderLanguageSelect";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserProfile } from "../common/UserProfile";
import { CartSection } from "../common/CartSection";
import SearchSection from "../common/SearchSection";
import { Logo } from "../common/Logo";
import {
  Bell, Menu, X,
  UtensilsCrossed, Tag, Users, Share2, BookOpen, Info,
  LogIn, LogOut, Star, ShoppingBag, User, MapPin,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks";
import { motion, AnimatePresence } from "motion/react";
import { useProfileQuery } from "@/services/profile/hooks";
import { NotificationBell, NotificationToast } from "../common/NotificationDropdown";
import { useNotificationStore } from "@/store/notification-store";
import { applyFaviconBadge } from "@/lib/favicon-badge";
import { useAuthStore } from "@/store/auth-store";
import { useRouter } from "@/i18n/navigation";

export function AppHeader() {
  const pathname = usePathname();
  const t = useTranslations();
  const { isLoggedIn, isHydrated, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: profile } = useProfileQuery();
  const clearSession = useAuthStore((s) => s.clearSession);
  const router = useRouter();

  const NAV: ReadonlyArray<{ href: string; label: string; Icon: React.ElementType }> = [
    { href: ROUTES.PRODUCTS, label: t("menu"), Icon: UtensilsCrossed },
    { href: ROUTES.PROMOTIONS, label: t("promotions"), Icon: Tag },
    { href: ROUTES.GROUP_ORDERS, label: t("group_orders"), Icon: Users },
    { href: ROUTES.REFERRAL, label: t("referral_and_earn"), Icon: Share2 },
    { href: ROUTES.LOYALTY_PAGE, label: t("loyalty_nav_label"), Icon: Star },
    { href: ROUTES.BLOG, label: t("blog"), Icon: BookOpen },
    { href: ROUTES.ABOUT, label: t("about"), Icon: Info },
  ];

  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const lastSeenCountRef = useRef<number | null>(null);

  useEffect(() => {
    function update() {
      if (document.visibilityState === "visible") {
        lastSeenCountRef.current = unreadCount;
      }
      const away = document.visibilityState === "hidden";
      const newCount = Math.max(0, unreadCount - (lastSeenCountRef.current ?? 0));
      const show = away && newCount > 0;
      const base = document.title.replace(/^\(\d+\)\s*/, "");
      document.title = show ? `(${newCount}) ${base}` : base;
      applyFaviconBadge(show);
    }
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [unreadCount]);

  const points = profile?.pointBalance ?? 0;
  const name = user?.name?.trim() || "Tài khoản";
  const initial = name.charAt(0).toUpperCase();

  function closeMenu() { setMenuOpen(false); }

  function handleLogout() {
    closeMenu();
    clearSession();
    router.push(ROUTES.HOME);
  }

  return (
    <>
      {/* ── Top bar ──────────────────────────────────────────── */}
      <Header className="sticky top-0 z-50 w-full border-b border-black/[0.06] bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
        <div className="container flex h-12 items-center justify-between gap-2 sm:h-14 sm:gap-3">

          {/* Logo */}
          <Link href={ROUTES.HOME} className="flex shrink-0 items-center outline-offset-4">
            <Logo size="sm" className="h-10 w-auto" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden flex-1 items-center justify-center gap-0.5 md:flex" aria-label="Điều hướng chính">
            {NAV.map(({ href, label }) => {
              const isActive = pathname.includes(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${isActive
                    ? "bg-kun-primary/[0.07] text-kun-primary"
                    : "text-foreground/60 hover:bg-black/[0.04] hover:text-foreground"
                    }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            <SearchSection />

            {/* Desktop only: lang */}
            <div className="hidden items-center gap-1.5 md:flex">
              <Suspense fallback={<div className="h-7 w-[58px] shrink-0" aria-hidden />}>
                <HeaderLanguageSelect />
              </Suspense>
            </div>

            {/* Bell — desktop, next to cart */}
            {isLoggedIn &&
              <div className="hidden md:block">
                <NotificationBell />
              </div>
            }

            {/* Cart */}
            {isLoggedIn && <CartSection />}

            {/* Desktop: full dropdown profile */}
            <div className="hidden md:block">
              <UserProfile />
            </div>

            {/* ── Mobile trigger ──────────────────────────────── */}
            {/* Always show hamburger; when logged-in + hydrated, also show avatar badge */}
            <div className="relative md:hidden">
              {isLoggedIn && unreadCount > 0 && (
                <span className="pointer-events-none absolute -right-0.5 -top-0.5 z-10 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold leading-none text-white ring-2 ring-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Mở menu điều hướng"
                className={`flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full transition-colors ${isHydrated && isLoggedIn
                  ? "ring-2 ring-kun-primary/30"
                  : "bg-surface-secondary text-foreground/70 hover:bg-surface-card"
                  }`}
              >
                {isHydrated && isLoggedIn ? (
                  user?.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatar} alt={name} className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-kun-primary text-xs font-bold text-white">
                      {initial}
                    </div>
                  )
                ) : (
                  <Menu className="size-[18px]" />
                )}
              </button>
            </div>
          </div>
        </div>
      </Header>

      {/* ── Mobile bottom-sheet drawer ───────────────────────── */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm md:hidden"
              onClick={closeMenu}
            />

            {/* Sheet */}
            <motion.div
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl md:hidden"
            >
              {/* Drag handle */}
              <div className="flex shrink-0 justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-black/10" />
              </div>

              {/* ── Sheet header ── */}
              {isLoggedIn ? (
                /* User card */
                <div className="shrink-0 px-5 pb-4 pt-2">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-kun-primary ring-2 ring-kun-primary/20">
                      {user?.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.avatar} alt={name} className="size-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-white">{initial}</span>
                      )}
                    </div>

                    {/* Name + points */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                      {points > 0 ? (
                        <button
                          type="button"
                          onClick={() => { closeMenu(); router.push(ROUTES.REWARDS); }}
                          className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200 transition hover:bg-amber-100"
                        >
                          <Star className="size-2.5 fill-amber-500 text-amber-500" />
                          {points.toLocaleString("vi-VN")} điểm
                        </button>
                      ) : (
                        <p className="truncate text-xs text-foreground/40">
                          {user?.phone ?? user?.email ?? ""}
                        </p>
                      )}
                    </div>

                    {/* Close */}
                    <button
                      type="button"
                      onClick={closeMenu}
                      aria-label="Đóng"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-card text-foreground/50 transition-colors hover:bg-surface-tertiary"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Guest header */
                <div className="shrink-0 flex items-center justify-between px-5 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Điều hướng</p>
                  <button
                    type="button"
                    onClick={closeMenu}
                    aria-label="Đóng"
                    className="flex size-8 items-center justify-center rounded-full bg-surface-card text-foreground/50 transition-colors hover:bg-surface-tertiary"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              )}

              <div className="mx-5 h-px shrink-0 bg-black/[0.06]" />

              {/* ── Scrollable body ── */}
              <div className="flex-1 overflow-y-auto overscroll-contain">

                {/* Main nav */}
                <nav className="px-3 py-2" aria-label="Điều hướng chính">
                  {NAV.map(({ href, label, Icon }, i) => {
                    const isActive = pathname.includes(href);
                    return (
                      <motion.div
                        key={href}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.032 + 0.04 }}
                      >
                        <Link
                          href={href}
                          onClick={closeMenu}
                          className={`flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-[15px] font-semibold transition-colors ${isActive
                            ? "bg-kun-primary/[0.08] text-kun-primary"
                            : "text-foreground hover:bg-surface-soft"
                            }`}
                        >
                          <Icon className={`size-[18px] shrink-0 ${isActive ? "text-kun-primary" : "text-foreground/35"}`} />
                          <span className="flex-1">{label}</span>
                          {isActive && <span className="size-1.5 rounded-full bg-kun-primary" />}
                        </Link>
                      </motion.div>
                    );
                  })}
                </nav>

                {/* Quick account links — logged-in only */}
                {isLoggedIn && (
                  <div className="px-4 pb-4">
                    <div className="mb-3 h-px bg-black/[0.05]" />
                    <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                      Tài khoản
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { href: ROUTES.ORDERS, label: t("order_history"), Icon: ShoppingBag },
                        { href: ROUTES.PROFILE, label: t("my_account"), Icon: User },
                        { href: ROUTES.NOTIFICATIONS, label: t("notifications"), Icon: Bell },
                        { href: ROUTES.ADDRESSES, label: t("shipping_addresses"), Icon: MapPin },
                      ].map(({ href, label, Icon: Ic }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={closeMenu}
                          className="flex items-center gap-2.5 rounded-2xl bg-surface-secondary px-3.5 py-3 text-sm font-medium text-foreground/65 transition-colors hover:bg-surface-card hover:text-foreground"
                        >
                          <Ic className="size-4 shrink-0 text-foreground/35" />
                          <span className="truncate">{label}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Footer ── */}
              <div className="shrink-0 border-t border-black/[0.06] px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <Suspense fallback={<div className="h-7 w-[58px] shrink-0" aria-hidden />}>
                    <HeaderLanguageSelect />
                  </Suspense>

                  {isLoggedIn ? (
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-foreground/50 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <LogOut className="size-3.5" />
                      Đăng xuất
                    </button>
                  ) : (
                    <Link
                      href={ROUTES.LOGIN}
                      onClick={closeMenu}
                      className="flex items-center gap-1.5 rounded-full bg-kun-primary px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    >
                      <User className="size-3.5" />
                      Đăng nhập
                    </Link>
                  )}
                </div>
              </div>

              {/* iOS home-indicator spacer */}
              <div className="h-[max(env(safe-area-inset-bottom),8px)] shrink-0" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <NotificationToast />
    </>
  );
}
