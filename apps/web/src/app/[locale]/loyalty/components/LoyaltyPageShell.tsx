"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertCircle, CheckCircle2, Loader2, Search, Star,
  User, X,
} from "lucide-react";
import Link from "next/link";
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

// ── helpers ───────────────────────────────────────────────────────────────────

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

const TYPE_LABEL: Record<string, string> = {
  delivery: "Giao hàng",
  pickup: "Nhận tại quán",
  table: "Tại bàn",
};

// ── sub-components ────────────────────────────────────────────────────────────

function OrderInfoCard({ info }: { info: LoyaltyOrderInfo }) {
  return (
    <div className="rounded-3xl border border-black/6 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.1)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Đơn hàng</p>
      <p className="mt-1 font-mono text-xl font-bold text-foreground">#{info.paymentCode}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-surface-secondary px-3 py-1 font-medium text-foreground/70">
          {TYPE_LABEL[info.type] ?? info.type}
        </span>
        <span className="rounded-full bg-surface-secondary px-3 py-1 font-medium text-foreground/70">
          {fmtDate(info.createdAt)}
        </span>
        <span className="rounded-full bg-surface-secondary px-3 py-1 font-medium text-foreground/70">
          {fmtVnd(info.finalAmount)}
        </span>
      </div>
    </div>
  );
}

function PointsPreviewCard({ points }: { points: number }) {
  return (
    <div className="rounded-3xl border border-kun-primary/20 bg-kun-primary/5 p-5">
      <div className="flex items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-kun-primary text-white">
          <Star className="size-5 fill-white" />
        </div>
        <div>
          <p className="text-sm text-foreground/60">Điểm sẽ được cộng</p>
          <p className="text-2xl font-bold text-kun-primary">+{Number.isInteger(points) ? points : points.toFixed(1)} điểm</p>
        </div>
      </div>
    </div>
  );
}

function UserResultRow({
  user,
  onSelect,
  isLoading,
}: {
  user: LoyaltyUser;
  onSelect: (u: LoyaltyUser) => void;
  isLoading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-2xl border border-black/6 bg-white p-3"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-secondary">
        <User className="size-4 text-muted" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
        <p className="truncate text-xs text-muted">{user.phone ?? user.email ?? "—"}</p>
      </div>
      <div className="text-right">
        <p className="text-[10px] text-muted">Hiện có</p>
        <p className="text-xs font-semibold text-kun-products-forest">{Number.isInteger(user.pointBalance) ? user.pointBalance : user.pointBalance.toFixed(1)} điểm</p>
      </div>
      <button
        type="button"
        disabled={isLoading}
        onClick={() => onSelect(user)}
        className="ml-1 rounded-full bg-kun-primary px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50 hover:opacity-90 transition"
      >
        Chọn
      </button>
    </motion.div>
  );
}

// ── main shell ────────────────────────────────────────────────────────────────

export function LoyaltyPageShell() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";

  const accessToken = useAuthStore((s) => s.accessToken);
  const { data: profile } = useProfileQuery();

  // Order state
  const [orderInfo, setOrderInfo] = useState<LoyaltyOrderInfo | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);

  // Claim state
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimedPoints, setClaimedPoints] = useState<number | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LoyaltyUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!code) {
      setFetchError("Mã đơn hàng không hợp lệ.");
      setIsFetching(false);
      return;
    }
    setIsFetching(true);
    fetchLoyaltyOrder(code)
      .then(setOrderInfo)
      .catch((err) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setFetchError(msg ?? "Không tìm thấy đơn hàng.");
      })
      .finally(() => setIsFetching(false));
  }, [code]);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchLoyaltyUsers(searchQuery.trim());
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
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
      setClaimError(msg ?? "Tích điểm thất bại. Vui lòng thử lại.");
    } finally {
      setIsClaiming(false);
    }
  }

  // ── render: loading ─────────────────────────────────────────────────────────
  if (isFetching) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-kun-primary" />
      </div>
    );
  }

  // ── render: error ───────────────────────────────────────────────────────────
  if (fetchError || !orderInfo) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-red-50">
          <AlertCircle className="size-7 text-red-500" />
        </div>
        <p className="font-semibold text-foreground">{fetchError ?? "Đơn hàng không tồn tại"}</p>
        <Link href={ROUTES.HOME} className="text-sm text-kun-products-forest hover:underline">
          Về trang chủ
        </Link>
      </div>
    );
  }

  // ── render: success ─────────────────────────────────────────────────────────
  if (claimedPoints !== null) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
          className="flex size-20 items-center justify-center rounded-full bg-kun-primary shadow-[0_0_0_12px_rgba(26,60,52,0.1)]"
        >
          <CheckCircle2 className="size-10 text-white" />
        </motion.div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Tích điểm thành công</p>
          <p className="mt-2 text-4xl font-bold text-kun-primary">+{claimedPoints}</p>
          <p className="mt-1 text-base text-foreground/70">điểm đã được cộng vào tài khoản</p>
        </div>
        <p className="max-w-xs text-sm text-foreground/55">
          Điểm thưởng sẽ khả dụng sau vài giờ theo chính sách UjCha.
        </p>
        {accessToken ? (
          <Link
            href={ROUTES.PROFILE}
            className="rounded-full bg-kun-primary px-8 py-3 text-sm font-semibold text-white hover:opacity-90 transition"
          >
            Xem tài khoản
          </Link>
        ) : (
          <Link
            href={ROUTES.HOME}
            className="rounded-full bg-kun-primary px-8 py-3 text-sm font-semibold text-white hover:opacity-90 transition"
          >
            Về trang chủ
          </Link>
        )}
      </motion.div>
    );
  }

  // ── render: not eligible ────────────────────────────────────────────────────
  const notEligibleReason = (() => {
    if (orderInfo.alreadyClaimed) return "Điểm thưởng đã được tích cho đơn hàng này rồi.";
    if (orderInfo.status !== "completed") return "Đơn hàng chưa hoàn thành — không thể tích điểm lúc này.";
    if (orderInfo.paymentStatus !== "paid") return "Đơn hàng chưa thanh toán — không thể tích điểm lúc này.";
    if (orderInfo.potentialPoints < 0.1) return "Đơn hàng không đủ điều kiện tích điểm.";
    return null;
  })();

  return (
    <div className="min-h-screen bg-surface-soft pb-20 pt-8">
      <div className="container mx-auto max-w-md px-4">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-center"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted">UjCha</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Tích điểm thưởng</h1>
          <p className="mt-1 text-sm text-foreground/55">Tích điểm từ đơn hàng để đổi ưu đãi</p>
        </motion.div>

        <div className="space-y-4">

          {/* Order info */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
            <OrderInfoCard info={orderInfo} />
          </motion.div>

          {/* Not eligible banner */}
          {notEligibleReason ? (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="flex items-start gap-3 rounded-3xl border border-amber-100 bg-amber-50 p-4"
            >
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-500" />
              <p className="text-sm text-amber-700">{notEligibleReason}</p>
            </motion.div>
          ) : (
            <>
              {/* Points preview */}
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
                <PointsPreviewCard points={orderInfo.potentialPoints} />
              </motion.div>

              {/* Claim error */}
              <AnimatePresence>
                {claimError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600"
                  >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    {claimError}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Claim for self (logged in) ─────────────────────── */}
              {accessToken && profile && (
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 }}
                  className="rounded-3xl border border-black/6 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.1)]"
                >
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                    Tài khoản của bạn
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-kun-primary/10">
                      <User className="size-4 text-kun-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">{profile.name}</p>
                      <p className="text-xs text-muted">{Number.isInteger(profile.pointBalance) ? profile.pointBalance : profile.pointBalance.toFixed(1)} điểm hiện có</p>
                    </div>
                    <button
                      type="button"
                      disabled={isClaiming}
                      onClick={() => void handleClaim(profile.id)}
                      className="flex items-center gap-2 rounded-full bg-kun-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90 transition"
                    >
                      {isClaiming ? <Loader2 className="size-4 animate-spin" /> : <Star className="size-4" />}
                      Tích điểm
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── Search for another member ──────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: accessToken ? 0.16 : 0.12 }}
                className="rounded-3xl border border-black/6 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.1)]"
              >
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                  {accessToken ? "Tích điểm cho người khác" : "Tìm tài khoản thành viên"}
                </p>

                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tên, số điện thoại hoặc email…"
                    className="w-full rounded-2xl border border-black/10 bg-surface-soft py-2.5 pl-10 pr-10 text-sm text-foreground outline-none placeholder:text-muted focus:border-kun-primary focus:ring-1 focus:ring-kun-primary/30 transition"
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

                {/* Search hint */}
                {searchQuery.length > 0 && searchQuery.length < 2 && (
                  <p className="mt-2 text-xs text-muted">Nhập ít nhất 2 ký tự để tìm kiếm.</p>
                )}

                {/* Results */}
                <AnimatePresence mode="wait">
                  {isSearching && (
                    <motion.div key="spinner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="mt-3 flex items-center justify-center py-4 text-muted"
                    >
                      <Loader2 className="size-5 animate-spin" />
                    </motion.div>
                  )}
                  {!isSearching && searchResults.length > 0 && (
                    <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="mt-3 space-y-2"
                    >
                      {searchResults.map((u) => (
                        <UserResultRow
                          key={u.id}
                          user={u}
                          onSelect={(u) => void handleClaim(u.id)}
                          isLoading={isClaiming}
                        />
                      ))}
                    </motion.div>
                  )}
                  {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                    <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="mt-3 text-center text-sm text-muted"
                    >
                      Không tìm thấy thành viên nào.
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Login prompt for guests */}
                {!accessToken && (
                  <p className="mt-4 text-center text-xs text-foreground/50">
                    Đã có tài khoản?{" "}
                    <Link href={ROUTES.LOGIN} className="font-medium text-kun-products-forest hover:underline">
                      Đăng nhập để tích điểm nhanh hơn
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
