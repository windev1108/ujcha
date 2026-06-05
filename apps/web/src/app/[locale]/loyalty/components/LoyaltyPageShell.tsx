"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  QrCode,
  Search,
  ShoppingBag,
  Star,
  Trophy,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/store/auth-store";
import { useProfileQuery } from "@/services/profile/hooks";
import {
  fetchLoyaltyOrder,
  claimLoyaltyPoints,
  searchLoyaltyUsers,
  type LoyaltyOrderInfo,
  type LoyaltyUser,
} from "@/services/loyalty/api";
import { ROUTES } from "@/lib/routes";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtVnd(s: string | number) {
  const n = typeof s === "string" ? parseFloat(s) : s;
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Shared hero (matches promotions page pattern) ────────────────────────────

function PageHero({
  eyebrow,
  title,
  subtitle,
  extra,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  extra?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#1a3c34] via-[#1e4438] to-[#112a21] px-5 pb-20 pt-16 sm:pb-24 sm:pt-20">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-24 -top-24 size-72 rounded-full bg-white/[0.03] blur-3xl" />
        <div className="absolute -bottom-16 left-1/4 size-96 rounded-full bg-[#99d6b3]/[0.06] blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-[72rem]">
        <div className="mx-auto max-w-2xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45"
          >
            {eyebrow}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.5 }}
            className="text-4xl font-bold tracking-tight text-white sm:text-5xl"
          >
            {title}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mx-auto mt-4 max-w-md text-base leading-relaxed text-white/60"
          >
            {subtitle}
          </motion.p>
          {extra}
        </div>
      </div>

      {/* Wave transition into white content */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 40" fill="none" className="w-full" aria-hidden>
          <path d="M0 40 C360 0 1080 0 1440 40 L1440 40 L0 40Z" fill="white" />
        </svg>
      </div>
    </section>
  );
}

// ─── Entry Screen ─────────────────────────────────────────────────────────────

function EntryScreen({
  onSubmit,
  isLoggedIn,
  isLoading,
  serverError,
  errorCode,
  onRetry,
}: {
  onSubmit: (code: string) => void;
  isLoggedIn: boolean;
  isLoading?: boolean;
  serverError?: string | null;
  errorCode?: string;
  onRetry?: () => void;
}) {
  const t = useTranslations();
  const [suffix, setSuffix] = useState("");
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    const trimmed = suffix.trim().toUpperCase();
    if (trimmed) onSubmit(`UJCHA-${trimmed}`);
  }

  const showError = touched && !suffix.trim();

  const steps = [
    { Icon: ShoppingBag, label: t("loyalty_how_1") },
    { Icon: QrCode,      label: t("loyalty_how_2") },
    { Icon: Trophy,      label: t("loyalty_how_3") },
  ];

  return (
    <div className="min-h-screen bg-white">
      <PageHero
        eyebrow="UjCha Loyalty"
        title={t("loyalty_enter_code_title")}
        subtitle={t("loyalty_enter_code_subtitle")}
      />

      <div className="bg-white px-5 pb-20">
        <div className="mx-auto max-w-md pt-6">

          {/* Input card — switches between form / loading / error */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, type: "spring", damping: 26, stiffness: 280 }}
            className={`rounded-3xl border p-6 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.12)] ${
              serverError
                ? "border-red-100 bg-red-50/60"
                : "border-black/[0.06] bg-white"
            }`}
          >
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-3 py-4"
                >
                  <div className="flex size-12 items-center justify-center rounded-full bg-kun-primary/10">
                    <Loader2 className="size-6 animate-spin text-kun-primary" />
                  </div>
                  <p className="text-sm text-muted">{t("loyalty_loading")}</p>
                </motion.div>
              ) : serverError ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-3 py-2 text-center"
                >
                  <div className="flex size-12 items-center justify-center rounded-full bg-white ring-4 ring-red-100">
                    <AlertCircle className="size-6 text-danger" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{serverError}</p>
                    {errorCode && (
                      <p className="mt-0.5 font-mono text-sm text-muted">#{errorCode}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onRetry}
                    className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-surface-card"
                  >
                    <ChevronLeft className="size-4" />
                    {t("loyalty_try_another")}
                  </button>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
                    {t("loyalty_code_eyebrow")}
                  </p>
                  <p className="mb-4 text-sm text-foreground/60">{t("loyalty_code_hint")}</p>

                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                      <div
                        className={`flex items-center gap-1 rounded-2xl border-2 bg-surface-soft px-4 py-3.5 transition-all ${
                          showError
                            ? "border-danger bg-red-50/60"
                            : "border-transparent focus-within:border-kun-primary focus-within:bg-white"
                        }`}
                      >
                        <QrCode className={`mr-2 size-5 shrink-0 transition-colors ${showError ? "text-danger" : "text-muted"}`} />
                        <span className="shrink-0 select-none font-mono text-base font-semibold tracking-widest text-muted/60">
                          UJCHA-
                        </span>
                        <input
                          ref={inputRef}
                          type="text"
                          value={suffix}
                          onChange={(e) => {
                            setSuffix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
                            setTouched(false);
                          }}
                          placeholder={t("loyalty_code_placeholder")}
                          className="flex-1 bg-transparent font-mono text-base font-semibold tracking-widest text-foreground outline-none placeholder:font-sans placeholder:text-sm placeholder:tracking-normal placeholder:font-normal placeholder:text-muted/50"
                          spellCheck={false}
                          autoComplete="off"
                          autoCapitalize="characters"
                          maxLength={20}
                        />
                        {suffix && (
                          <button
                            type="button"
                            onClick={() => { setSuffix(""); setTouched(false); inputRef.current?.focus(); }}
                            className="shrink-0 rounded-full p-0.5 text-muted transition-colors hover:bg-surface-card hover:text-foreground"
                          >
                            <X className="size-4" />
                          </button>
                        )}
                      </div>
                      <AnimatePresence>
                        {showError && (
                          <motion.p
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-danger"
                          >
                            <AlertCircle className="size-3.5 shrink-0" />
                            {t("loyalty_code_required")}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>

                    <button
                      type="submit"
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1a3c34] py-3.5 text-sm font-semibold text-white shadow-[0_4px_16px_-4px_rgba(26,60,52,0.4)] transition-all hover:opacity-90 active:scale-[0.98]"
                    >
                      {t("loyalty_find_btn")}
                      <ArrowRight className="size-4" />
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* How it works */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34 }}
            className="mt-8 rounded-3xl border border-black/[0.06] bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)]"
          >
            <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.28em] text-muted">
              {t("loyalty_how_title")}
            </p>

            <div className="flex items-start justify-between gap-2">
              {steps.map(({ Icon, label }, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.42 + i * 0.08 }}
                  className="flex flex-1 flex-col items-center gap-2.5"
                >
                  {/* Step connector line */}
                  <div className="relative flex w-full items-center justify-center">
                    {i > 0 && (
                      <div className="absolute right-[calc(50%+20px)] top-1/2 h-px w-full -translate-y-1/2 bg-black/[0.06]" />
                    )}
                    <div className="relative z-10 flex size-11 items-center justify-center rounded-2xl bg-surface-soft ring-1 ring-black/[0.05]">
                      <Icon className="size-5 text-[#1a3c34]" />
                    </div>
                  </div>
                  <p className="text-center text-[11px] font-medium leading-snug text-foreground/65">
                    {label}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Login prompt */}
          {!isLoggedIn && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.56 }}
              className="mt-4 rounded-3xl border border-kun-primary/15 bg-kun-primary/[0.04] px-5 py-4 text-center"
            >
              <p className="text-sm text-foreground/60">
                {t("loyalty_login_prompt")}{" "}
                <Link href={ROUTES.LOGIN} className="font-semibold text-kun-primary hover:underline">
                  {t("loyalty_login_link")}
                </Link>
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Order info card ──────────────────────────────────────────────────────────

function OrderInfoCard({ info }: { info: LoyaltyOrderInfo }) {
  const t = useTranslations();
  const typeLabels: Record<string, string> = {
    delivery: t("loyalty_order_type_delivery"),
    pickup:   t("loyalty_order_type_pickup"),
    table:    t("loyalty_order_type_table"),
  };
  const meta = [
    { label: t("loyalty_order_type_label"),  value: typeLabels[info.type] ?? info.type },
    { label: t("loyalty_order_date_label"),  value: fmtDate(info.createdAt) },
    { label: t("loyalty_order_total_label"), value: fmtVnd(info.finalAmount) },
  ];

  return (
    <div className="overflow-hidden rounded-3xl border border-black/[0.06] bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.1)]">
      <div className="bg-gradient-to-r from-[#1a3c34] to-[#2d6a55] px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">
          {t("loyalty_order_eyebrow")}
        </p>
        <p className="mt-0.5 font-mono text-xl font-bold tracking-wider text-white">
          #{info.paymentCode}
        </p>
      </div>
      <div className="grid grid-cols-3 divide-x divide-black/[0.06]">
        {meta.map((m) => (
          <div key={m.label} className="px-4 py-3">
            <p className="text-[10px] text-muted">{m.label}</p>
            <p className="mt-0.5 text-xs font-semibold text-foreground leading-tight">{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Points preview card ──────────────────────────────────────────────────────

function PointsPreviewCard({ points }: { points: number }) {
  const t = useTranslations();
  const display = Number.isInteger(points) ? points : points.toFixed(1);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a3c34] to-[#26634d] p-5">
      <div className="pointer-events-none absolute -right-8 -top-8 size-36 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-6 -left-6 size-24 rounded-full bg-[#c9a227]/20 blur-xl" />
      <div className="relative flex items-center gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/10">
          <Trophy className="size-7 text-[#c9a227]" />
        </div>
        <div>
          <p className="text-sm text-white/65">{t("loyalty_points_will_be_added")}</p>
          <p className="text-3xl font-bold text-white">+{display}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Member search row ────────────────────────────────────────────────────────

function MemberRow({ user, onSelect, busy }: { user: LoyaltyUser; onSelect: (u: LoyaltyUser) => void; busy: boolean }) {
  const t = useTranslations();
  const pts = Number.isInteger(user.pointBalance) ? user.pointBalance : user.pointBalance.toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-3"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-card">
        <User className="size-4 text-muted" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
        <p className="truncate text-xs text-muted">{user.phone ?? user.email ?? "—"}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[10px] text-muted">{t("loyalty_user_current_points")}</p>
        <p className="text-xs font-semibold text-kun-primary">{pts} pts</p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => onSelect(user)}
        className="ml-1 rounded-full bg-[#1a3c34] px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity disabled:opacity-50 hover:opacity-90"
      >
        {t("loyalty_select_btn")}
      </button>
    </motion.div>
  );
}

// ─── Main shell ───────────────────────────────────────────────────────────────

export function LoyaltyPageShell() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get("code") ?? "";

  const accessToken = useAuthStore((s) => s.accessToken);
  const { data: profile } = useProfileQuery();

  const [orderInfo, setOrderInfo]   = useState<LoyaltyOrderInfo | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(!!code);

  const [isClaiming, setIsClaiming]       = useState(false);
  const [claimedPoints, setClaimedPoints] = useState<number | null>(null);
  const [claimError, setClaimError]       = useState<string | null>(null);

  const [searchQuery, setSearchQuery]     = useState("");
  const [searchResults, setSearchResults] = useState<LoyaltyUser[]>([]);
  const [isSearching, setIsSearching]     = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!code) {
      setOrderInfo(null);
      setFetchError(null);
      setIsFetching(false);
      return;
    }
    setIsFetching(true);
    setOrderInfo(null);
    setFetchError(null);
    setClaimedPoints(null);
    fetchLoyaltyOrder(code)
      .then(setOrderInfo)
      .catch((err) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setFetchError(msg ?? t("loyalty_order_not_found"));
      })
      .finally(() => setIsFetching(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (searchQuery.trim().length < 2) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setIsSearching(true);
      try { setSearchResults(await searchLoyaltyUsers(searchQuery.trim())); }
      catch { setSearchResults([]); }
      finally { setIsSearching(false); }
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  async function handleClaim(userId: string) {
    if (!orderInfo || isClaiming) return;
    setIsClaiming(true);
    setClaimError(null);
    try {
      const result = await claimLoyaltyPoints(orderInfo.paymentCode, userId);
      setClaimedPoints(result.points);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setClaimError(msg ?? t("loyalty_claim_error_default"));
    } finally {
      setIsClaiming(false);
    }
  }

  // ── No code / loading / fetch error → entry screen ────────────────────────
  if (!code || isFetching || fetchError || !orderInfo) {
    return (
      <EntryScreen
        isLoggedIn={!!accessToken}
        onSubmit={(c) => router.push(ROUTES.LOYALTY(c))}
        isLoading={isFetching}
        serverError={fetchError}
        errorCode={fetchError ? code : undefined}
        onRetry={() => router.push(ROUTES.LOYALTY_PAGE)}
      />
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (claimedPoints !== null) {
    const displayPoints = Number.isInteger(claimedPoints) ? claimedPoints : claimedPoints.toFixed(1);
    return (
      <div className="min-h-screen bg-white">
        <PageHero
          eyebrow="UjCha Loyalty"
          title={t("loyalty_success_eyebrow")}
          subtitle={t("loyalty_success_desc")}
        />

        <div className="bg-white px-5 pb-20">
          <div className="mx-auto max-w-md space-y-4 pt-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, type: "spring", damping: 26, stiffness: 280 }}
              className="rounded-3xl border border-black/[0.06] bg-white p-6 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.12)]"
            >
              {/* Icon + points */}
              <div className="flex flex-col items-center gap-4 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 18, delay: 0.22 }}
                  className="flex size-16 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/60"
                >
                  <CheckCircle2 className="size-8 text-emerald-500" />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.38 }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
                    {t("loyalty_points_will_be_added")}
                  </p>
                  <p className="mt-1 text-[52px] font-bold leading-none tabular-nums text-[#c9a227]">
                    +{displayPoints}
                  </p>
                </motion.div>
              </div>

              {/* Note */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.52 }}
                className="mt-5 rounded-2xl bg-surface-soft px-4 py-3 text-center text-xs leading-relaxed text-muted"
              >
                {t("loyalty_success_note")}
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.64 }}
                className="mt-4 flex gap-3"
              >
                <button
                  type="button"
                  onClick={() => router.push(ROUTES.LOYALTY_PAGE)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-black/10 bg-white py-3 text-sm font-medium text-foreground/70 transition-colors hover:bg-surface-card"
                >
                  <ChevronLeft className="size-4" />
                  {t("loyalty_try_another")}
                </button>
                {accessToken ? (
                  <Link
                    href={ROUTES.PROFILE}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#1a3c34] py-3 text-sm font-semibold text-white shadow-[0_4px_16px_-4px_rgba(26,60,52,0.35)] transition hover:opacity-90"
                  >
                    <Star className="size-4 fill-[#c9a227] text-[#c9a227]" />
                    {t("loyalty_view_account")}
                  </Link>
                ) : (
                  <Link
                    href={ROUTES.HOME}
                    className="flex flex-1 items-center justify-center rounded-full bg-[#1a3c34] py-3 text-sm font-semibold text-white shadow-[0_4px_16px_-4px_rgba(26,60,52,0.35)] transition hover:opacity-90"
                  >
                    {t("loyalty_go_home")}
                  </Link>
                )}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  // ── Not eligible ───────────────────────────────────────────────────────────
  const notEligibleReason = (() => {
    if (orderInfo.alreadyClaimed)           return t("loyalty_already_claimed");
    if (orderInfo.status !== "completed")   return t("loyalty_not_completed");
    if (orderInfo.paymentStatus !== "paid") return t("loyalty_not_paid");
    if (orderInfo.potentialPoints < 0.1)    return t("loyalty_not_eligible");
    return null;
  })();

  // ── Verify / Claim ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      <PageHero
        eyebrow="UjCha Loyalty"
        title={t("loyalty_title")}
        subtitle={`#${orderInfo.paymentCode}`}
      />

      <div className="bg-white px-5 pb-20">
        <div className="mx-auto max-w-md space-y-4 pt-6">

          {/* Back */}
          <motion.button
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            type="button"
            onClick={() => router.push(ROUTES.LOYALTY_PAGE)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-foreground/55 transition hover:bg-surface-card hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />
            {t("loyalty_try_another")}
          </motion.button>

          {/* Order info */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <OrderInfoCard info={orderInfo} />
          </motion.div>

          {notEligibleReason ? (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="flex items-start gap-3 rounded-3xl border border-amber-100 bg-amber-50 p-5"
            >
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-500" />
              <div>
                <p className="text-sm font-semibold text-amber-800">{t("loyalty_not_eligible_title")}</p>
                <p className="mt-0.5 text-sm text-amber-700">{notEligibleReason}</p>
              </div>
            </motion.div>
          ) : (
            <>
              {/* Points preview */}
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                <PointsPreviewCard points={orderInfo.potentialPoints} />
              </motion.div>

              {/* Claim error */}
              <AnimatePresence>
                {claimError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-2 overflow-hidden rounded-2xl bg-red-50 px-4 py-3 text-sm text-danger"
                  >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    {claimError}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Self-claim */}
              {accessToken && profile && (
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.26 }}
                  className="rounded-3xl border border-black/[0.06] bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.1)]"
                >
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                    {t("loyalty_my_account_eyebrow")}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-kun-primary/10">
                      <User className="size-4 text-kun-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">{profile.name}</p>
                      <p className="text-xs text-muted">
                        {t("loyalty_current_points", {
                          points: Number.isInteger(profile.pointBalance)
                            ? profile.pointBalance
                            : profile.pointBalance.toFixed(1),
                        })}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isClaiming}
                      onClick={() => void handleClaim(profile.id)}
                      className="flex items-center gap-2 rounded-full bg-[#1a3c34] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_2px_12px_-4px_rgba(26,60,52,0.4)] transition disabled:opacity-60 hover:opacity-90"
                    >
                      {isClaiming
                        ? <Loader2 className="size-4 animate-spin" />
                        : <Star className="size-4 fill-[#c9a227] text-[#c9a227]" />
                      }
                      {isClaiming ? t("loyalty_claiming") : t("loyalty_claim_btn")}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Member search */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: accessToken ? 0.34 : 0.26 }}
                className="rounded-3xl border border-black/[0.06] bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.1)]"
              >
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                  {accessToken ? t("loyalty_search_other_eyebrow") : t("loyalty_search_eyebrow")}
                </p>

                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("loyalty_search_placeholder")}
                    className="w-full rounded-2xl border border-black/10 bg-surface-soft py-2.5 pl-10 pr-10 text-sm text-foreground outline-none placeholder:text-muted focus:border-kun-primary focus:ring-1 focus:ring-kun-primary/25 transition"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>

                {searchQuery.length > 0 && searchQuery.length < 2 && (
                  <p className="mt-2 text-xs text-muted">{t("loyalty_search_hint")}</p>
                )}

                <AnimatePresence mode="wait">
                  {isSearching && (
                    <motion.div key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="mt-3 flex justify-center py-4"
                    >
                      <Loader2 className="size-5 animate-spin text-muted" />
                    </motion.div>
                  )}
                  {!isSearching && searchResults.length > 0 && (
                    <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="mt-3 space-y-2"
                    >
                      {searchResults.map((u) => (
                        <MemberRow key={u.id} user={u} onSelect={(u) => void handleClaim(u.id)} busy={isClaiming} />
                      ))}
                    </motion.div>
                  )}
                  {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                    <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="mt-3 text-center text-sm text-muted"
                    >
                      {t("loyalty_search_empty")}
                    </motion.p>
                  )}
                </AnimatePresence>

                {!accessToken && (
                  <p className="mt-4 text-center text-xs text-foreground/50">
                    {t("loyalty_login_prompt")}{" "}
                    <Link href={ROUTES.LOGIN} className="font-medium text-kun-primary hover:underline">
                      {t("loyalty_login_link")}
                    </Link>
                  </p>
                )}
              </motion.div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
