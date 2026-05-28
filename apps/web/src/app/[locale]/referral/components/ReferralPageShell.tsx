"use client";

import { Fragment, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Crown,
  Gem,
  Gift,
  Info,
  Link2,
  Loader2,
  Medal,
  Shield,
  ShieldAlert,
  ShieldOff,
  Share2,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  Wifi,
  Zap,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAuthStore } from "@/store/auth-store";
import { useProfileQuery } from "@/services/profile/hooks";
import { useMyVouchersQuery } from "@/services/voucher/hooks";
import {
  useReferralStatsQuery,
  useReferralInvitationsQuery,
  useClaimedMilestonesQuery,
  useClaimMilestoneMutation,
  useReferralLeaderboardQuery,
} from "@/services/referral/hooks";
import type { MyVoucherItem } from "@/services/voucher/api";
import type {
  ReferralInvitation,
  InvitationStatus,
  MilestoneTierId,
  ReferralPublicConfig,
  LeaderboardEntry,
} from "@/services/referral/api";
import { ROUTES } from "@/lib/routes";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtVnd(s: string | number) {
  const n = typeof s === "string" ? parseFloat(s) : s;
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ── milestone config ──────────────────────────────────────────────────────────

type Tier = {
  id: MilestoneTierId;
  label: string;
  threshold: number;
  points: number;
  icon: React.ElementType;
  gradient: string;
  activeText: string;
  badge: string;
};

const TIER_VISUAL = [
  { id: "bronze" as MilestoneTierId, label: "Đồng", icon: Shield, gradient: "from-amber-400 to-orange-500", activeText: "text-amber-700", badge: "bg-amber-100 text-amber-700" },
  { id: "silver" as MilestoneTierId, label: "Bạc", icon: Medal, gradient: "from-slate-400 to-zinc-500", activeText: "text-slate-600", badge: "bg-slate-100 text-slate-600" },
  { id: "gold" as MilestoneTierId, label: "Vàng", icon: Star, gradient: "from-yellow-400 to-amber-500", activeText: "text-yellow-700", badge: "bg-yellow-100 text-yellow-700" },
  { id: "diamond" as MilestoneTierId, label: "Kim cương", icon: Gem, gradient: "from-violet-500 to-indigo-600", activeText: "text-violet-700", badge: "bg-violet-100 text-violet-700" },
];

function buildTiers(cfg: ReferralPublicConfig | null): Tier[] {
  return [
    { ...TIER_VISUAL[0]!, threshold: cfg?.bronzeThreshold ?? 5, points: cfg?.bronzePoints ?? 100 },
    { ...TIER_VISUAL[1]!, threshold: cfg?.silverThreshold ?? 10, points: cfg?.silverPoints ?? 250 },
    { ...TIER_VISUAL[2]!, threshold: cfg?.goldThreshold ?? 50, points: cfg?.goldPoints ?? 1000 },
    { ...TIER_VISUAL[3]!, threshold: cfg?.diamondThreshold ?? 100, points: cfg?.diamondPoints ?? 3000 },
  ];
}

function getCurrentTier(count: number, tiers: Tier[]) {
  return [...tiers].reverse().find((t) => count >= t.threshold) ?? null;
}

function getNextTier(count: number, tiers: Tier[]) {
  return tiers.find((t) => count < t.threshold) ?? null;
}

// ── invitation status helpers ─────────────────────────────────────────────────

type StatusMeta = {
  label: string;
  sublabel: string;
  icon: React.ElementType;
  badgeBg: string;
  badgeText: string;
  iconColor: string;
};

function getStatusMeta(status: InvitationStatus): StatusMeta {
  switch (status) {
    case "rewarded":
      return { label: "Đã thưởng", sublabel: "Điểm đã được cộng vào tài khoản của bạn", icon: CheckCircle2, badgeBg: "bg-emerald-50", badgeText: "text-emerald-700", iconColor: "text-emerald-500" };
    case "pending_first_order":
      return { label: "Chờ đơn đầu tiên", sublabel: "Bạn bè chưa đặt đơn hàng nào", icon: Clock, badgeBg: "bg-sky-50", badgeText: "text-sky-700", iconColor: "text-sky-400" };
    case "eligible_processing":
      return { label: "Đang xử lý", sublabel: "Đơn đủ điều kiện — phần thưởng sẽ được cộng sớm", icon: Zap, badgeBg: "bg-amber-50", badgeText: "text-amber-700", iconColor: "text-amber-500" };
    case "rejected_blocked_ip":
      return { label: "Từ chối — Cùng mạng", sublabel: "Bạn bè đăng ký từ cùng địa chỉ IP với bạn", icon: Wifi, badgeBg: "bg-red-50", badgeText: "text-red-700", iconColor: "text-red-500" };
    case "rejected_blocked_device":
      return { label: "Từ chối — Cùng thiết bị", sublabel: "Bạn bè đăng ký từ cùng thiết bị với bạn", icon: Smartphone, badgeBg: "bg-red-50", badgeText: "text-red-700", iconColor: "text-red-500" };
    case "rejected_phone_not_verified":
      return { label: "Từ chối — Chưa xác minh", sublabel: "Bạn bè chưa xác minh số điện thoại", icon: ShieldOff, badgeBg: "bg-orange-50", badgeText: "text-orange-700", iconColor: "text-orange-500" };
    case "rejected_below_min_amount":
      return { label: "Từ chối — Đơn quá nhỏ", sublabel: "Giá trị đơn đầu tiên chưa đạt mức tối thiểu", icon: AlertTriangle, badgeBg: "bg-orange-50", badgeText: "text-orange-700", iconColor: "text-orange-500" };
  }
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatPill({ icon: Icon, value, label, delay }: { icon: React.ElementType; value: string | number; label: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="flex flex-col items-center gap-1.5"
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/10">
        <Icon className="size-5 text-white" />
      </div>
      <p className="text-2xl font-black text-white tabular-nums leading-none">{value}</p>
      <p className="text-[11px] font-medium text-white/60">{label}</p>
    </motion.div>
  );
}

function MilestoneTrack({ successfulReferrals, tiers }: { successfulReferrals: number; tiers: Tier[] }) {
  const currentTier = getCurrentTier(successfulReferrals, tiers);
  const nextTier = getNextTier(successfulReferrals, tiers);
  const prevThreshold = currentTier?.threshold ?? 0;
  const nextThreshold = nextTier?.threshold ?? tiers[tiers.length - 1]!.threshold;
  const range = nextThreshold - prevThreshold;
  const progress = nextTier ? Math.min(1, (successfulReferrals - prevThreshold) / range) : 1;

  return (
    <div className="rounded-3xl border border-black/6 bg-white px-5 py-6 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)] sm:px-6 sm:py-8">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Hành trình thành viên</p>

      <div className="mt-5 flex items-center overflow-x-auto pb-1">
        {tiers.map((tier, i) => {
          const Icon = tier.icon;
          const reached = successfulReferrals >= tier.threshold;
          const isCurrent = currentTier?.id === tier.id;
          const isLast = i === tiers.length - 1;
          const nextTierForBar = tiers[i + 1];
          const barFilled = nextTierForBar && successfulReferrals >= nextTierForBar.threshold;
          const barPartial = nextTierForBar && reached && !barFilled && currentTier?.id === tier.id;

          return (
            <Fragment key={tier.id}>
              <div className="flex shrink-0 flex-col items-center gap-1">
                <motion.div
                  initial={false}
                  animate={isCurrent ? { scale: [1, 1.12, 1] } : reached ? { scale: 1 } : { scale: 0.92 }}
                  transition={{ duration: 0.5 }}
                  className={`relative flex size-9 items-center justify-center rounded-full ring-2 transition-all sm:size-10 ${reached ? `bg-gradient-to-br ${tier.gradient} ring-white shadow-md` : "bg-surface-card ring-transparent"} ${isCurrent ? "shadow-lg ring-kun-primary/30 ring-offset-2" : ""}`}
                >
                  <Icon className={`size-3.5 sm:size-4 ${reached ? "text-white" : "text-muted"}`} />
                  {isCurrent && (
                    <span className="absolute -right-0.5 -top-0.5 flex size-3 items-center justify-center rounded-full bg-kun-primary ring-2 ring-white">
                      <Zap className="size-1.5 text-white" />
                    </span>
                  )}
                </motion.div>
                <p className={`max-w-[52px] text-center text-[9px] font-semibold leading-tight sm:text-[10px] ${reached ? tier.activeText : "text-muted"}`}>{tier.label}</p>
                <p className="text-[9px] text-muted">{tier.threshold}+</p>
              </div>

              {!isLast && (
                <div className="relative mx-1 h-1.5 min-w-[20px] flex-1 overflow-hidden rounded-full bg-surface-card">
                  {barFilled && (
                    <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 0.6, delay: i * 0.1 }} className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${tier.gradient}`} />
                  )}
                  {barPartial && (
                    <motion.div initial={{ width: 0 }} animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.8, delay: 0.2 }} className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${tier.gradient}`} />
                  )}
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl bg-surface-soft px-4 py-3.5">
        {nextTier ? (
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {successfulReferrals === 0
                  ? `Mời ${nextTier.threshold} người để đạt ${nextTier.label}`
                  : `Còn ${nextTier.threshold - successfulReferrals} lượt → ${nextTier.label}`}
              </p>
              <p className="text-xs text-muted">
                {currentTier
                  ? `Hiện tại: ${currentTier.label} · ${successfulReferrals} lượt hợp lệ`
                  : "Bắt đầu mời để nhận huy hiệu đầu tiên"}
              </p>
            </div>
            {(() => {
              const NextIcon = nextTier.icon;
              return (
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-card">
                  <NextIcon className="size-4 text-muted" />
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Crown className="size-5 text-violet-500" />
            <div>
              <p className="font-semibold text-foreground">Kim cương — Đỉnh cao!</p>
              <p className="text-xs text-muted">Bạn đã đạt cấp cao nhất của chương trình</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FraudWarningBanners({ blockIp, blockDevice }: { blockIp: boolean; blockDevice: boolean }) {
  if (!blockIp && !blockDevice) return null;
  return (
    <div className="space-y-2">
      {blockIp && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Wifi className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Lưu ý: Hệ thống chặn cùng địa chỉ mạng</p>
            <p className="mt-0.5 text-xs text-amber-700">Bạn bè đăng ký từ cùng mạng WiFi hoặc IP với bạn sẽ <strong>không được tính phần thưởng</strong>. Hãy đảm bảo họ dùng mạng di động riêng hoặc mạng khác khi tạo tài khoản.</p>
          </div>
        </motion.div>
      )}
      {blockDevice && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Smartphone className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Lưu ý: Hệ thống chặn cùng thiết bị</p>
            <p className="mt-0.5 text-xs text-amber-700">Mỗi người cần đăng ký từ <strong>thiết bị riêng của họ</strong>. Giới thiệu từ cùng điện thoại hoặc máy tính sẽ bị từ chối tự động để chống gian lận.</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function InvitationRow({ item, index }: { item: ReferralInvitation; index: number }) {
  const meta = getStatusMeta(item.status);
  const StatusIcon = meta.icon;
  const isRejected = item.status.startsWith("rejected_");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`flex items-start gap-3 rounded-xl border px-3 py-3 ${isRejected ? "border-red-100 bg-red-50/50" : "border-black/[0.05] bg-surface-soft"}`}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-black/[0.07]">
        <UserCheck className="size-4 text-muted" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
          {item.emailMasked && <span>{item.emailMasked}</span>}
          {item.phoneMasked && <span>{item.phoneMasked}</span>}
          <span>{fmtDate(item.joinedAt)}</span>
        </div>
        {isRejected && (
          <div className="mt-1.5 flex items-start gap-1.5">
            <StatusIcon className={`mt-0.5 size-3.5 shrink-0 ${meta.iconColor}`} />
            <p className={`text-[11px] font-medium leading-snug ${meta.badgeText}`}>{meta.sublabel}</p>
          </div>
        )}
        {item.status === "eligible_processing" && (
          <div className="mt-1.5 flex items-start gap-1.5">
            <Zap className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
            <p className="text-[11px] font-medium text-amber-700 leading-snug">{meta.sublabel}</p>
          </div>
        )}
      </div>
      <div className="shrink-0">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.badgeBg} ${meta.badgeText}`}>
          <StatusIcon className="size-3" />
          {meta.label}
        </span>
        {item.pointsGranted !== null && item.pointsGranted > 0 && (
          <p className="mt-1 text-right text-[11px] font-bold text-kun-primary">+{item.pointsGranted} điểm</p>
        )}
      </div>
    </motion.div>
  );
}

function InvitationsSection() {
  const { data: invitations = [], isLoading } = useReferralInvitationsQuery();
  const rejectedCount = invitations.filter((i) => i.status.startsWith("rejected_")).length;
  const rewardedCount = invitations.filter((i) => i.status === "rewarded").length;
  const pendingCount = invitations.filter((i) => i.status === "pending_first_order").length;
  const processingCount = invitations.filter((i) => i.status === "eligible_processing").length;

  return (
    <div className="rounded-3xl border border-black/6 bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-kun-primary/10">
            <Users className="size-4 text-kun-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Người đã mời</p>
            <p className="text-xs text-muted">{isLoading ? "Đang tải…" : `${invitations.length} người đăng ký qua mã của bạn`}</p>
          </div>
        </div>
        {!isLoading && invitations.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {rewardedCount > 0 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">✓ {rewardedCount} thưởng</span>}
            {processingCount > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">⟳ {processingCount} xử lý</span>}
            {pendingCount > 0 && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">… {pendingCount} chờ đơn</span>}
            {rejectedCount > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">✕ {rejectedCount} từ chối</span>}
          </div>
        )}
      </div>
      <div className="px-5 pb-5 pt-4 sm:px-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="size-5 animate-spin text-kun-primary" /></div>
        ) : invitations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-surface-card"><UserPlus className="size-5 text-muted" /></div>
            <p className="text-sm font-medium text-foreground">Chưa có ai đăng ký qua mã của bạn</p>
            <p className="text-xs text-muted">Chia sẻ link ở trên để bắt đầu mời bạn bè</p>
          </div>
        ) : (
          <div className="space-y-2">
            {invitations.map((item, i) => <InvitationRow key={item.id} item={item} index={i} />)}
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-black/[0.05] bg-surface-soft px-3 py-2.5">
              <Info className="mt-0.5 size-3.5 shrink-0 text-muted" />
              <p className="text-[11px] text-muted">Email và số điện thoại được ẩn một phần để bảo vệ quyền riêng tư. Chỉ lượt giới thiệu hợp lệ mới tính thưởng — xem lý do từ chối trên từng dòng.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── leaderboard ───────────────────────────────────────────────────────────────

const RANK_CONFIG: Record<number, { bg: string; border: string; nameCls: string; countCls: string; glow: string; icon: React.ElementType; iconCls: string }> = {
  1: { bg: "bg-gradient-to-br from-amber-50 to-yellow-50", border: "border-amber-200", nameCls: "text-amber-900 font-bold", countCls: "text-amber-700 font-bold", glow: "shadow-[0_0_18px_-4px_rgba(251,191,36,0.55)]", icon: Crown, iconCls: "text-amber-500" },
  2: { bg: "bg-gradient-to-br from-slate-50 to-zinc-50", border: "border-slate-200", nameCls: "text-slate-800 font-semibold", countCls: "text-slate-600 font-semibold", glow: "shadow-[0_0_14px_-4px_rgba(148,163,184,0.5)]", icon: Medal, iconCls: "text-slate-400" },
  3: { bg: "bg-gradient-to-br from-orange-50 to-amber-50", border: "border-orange-200", nameCls: "text-orange-900 font-semibold", countCls: "text-orange-700 font-semibold", glow: "shadow-[0_0_14px_-4px_rgba(251,146,60,0.45)]", icon: Medal, iconCls: "text-orange-400" },
};

const TIER_BADGE: Record<MilestoneTierId, { label: string; cls: string }> = {
  diamond: { label: "Kim cương", cls: "bg-violet-100 text-violet-700" },
  gold: { label: "Vàng", cls: "bg-yellow-100 text-yellow-700" },
  silver: { label: "Bạc", cls: "bg-slate-100 text-slate-600" },
  bronze: { label: "Đồng", cls: "bg-amber-100 text-amber-700" },
};

function LeaderboardRow({ entry, isMe, index }: { entry: LeaderboardEntry; isMe: boolean; index: number }) {
  const rank = entry.rank;
  const top = RANK_CONFIG[rank];
  const tierMeta = entry.tier ? TIER_BADGE[entry.tier] : null;
  const isTop3 = rank <= 3;

  const avatarFallbackCls =
    rank === 1 ? "bg-amber-100 text-amber-700"
      : rank === 2 ? "bg-slate-100 text-slate-600"
        : rank === 3 ? "bg-orange-100 text-orange-700"
          : "bg-surface-card text-foreground/60";

  const AvatarNode = ({ size }: { size: "md" | "sm" }) => {
    const cls = size === "md"
      ? `size-10 text-sm font-bold ring-2 ring-white shadow-sm ${avatarFallbackCls}`
      : `size-8 text-xs font-bold ${avatarFallbackCls}`;
    if (entry.avatar) {
      return <img src={entry.avatar} alt={entry.name} className={`shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm ${size === "md" ? "size-10" : "size-8"}`} />;
    }
    return <div className={`flex shrink-0 items-center justify-center rounded-full ${cls}`}>{entry.name.charAt(0).toUpperCase()}</div>;
  };

  if (isTop3 && top) {
    const RankIcon = top.icon;
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.06 }}
        className={`relative flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all ${top.bg} ${top.border} ${top.glow} ${isMe ? "ring-2 ring-kun-primary ring-offset-1" : ""}`}
      >
        <div className="flex size-9 shrink-0 flex-col items-center justify-center rounded-xl bg-white/70 shadow-sm">
          <RankIcon className={`size-4 ${top.iconCls}`} />
          <span className="text-[9px] font-black leading-none text-foreground/50">#{rank}</span>
        </div>
        <AvatarNode size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className={`truncate text-sm ${top.nameCls}`}>{entry.name}</p>
            {isMe && <span className="rounded-full bg-kun-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-kun-primary">Bạn</span>}
          </div>
          {tierMeta && <span className={`mt-0.5 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${tierMeta.cls}`}>{tierMeta.label}</span>}
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-lg tabular-nums leading-none ${top.countCls}`}>{entry.successfulReferrals}</p>
          <p className="mt-0.5 text-[10px] text-foreground/40">lượt</p>
        </div>
        {rank === 1 && <div className="pointer-events-none absolute -top-px inset-x-4 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`flex items-center gap-3 rounded-xl border border-black/[0.05] bg-surface-soft px-4 py-3 ${isMe ? "border-kun-primary/30 bg-kun-primary/[0.04] ring-1 ring-kun-primary/20" : ""}`}
    >
      <span className="w-6 shrink-0 text-center text-xs font-bold tabular-nums text-muted">#{rank}</span>
      <AvatarNode size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-foreground">{entry.name}</p>
          {isMe && <span className="rounded-full bg-kun-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-kun-primary">Bạn</span>}
        </div>
        {tierMeta && <span className={`mt-0.5 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${tierMeta.cls}`}>{tierMeta.label}</span>}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-foreground">{entry.successfulReferrals}</p>
        <p className="text-[10px] text-muted">lượt</p>
      </div>
    </motion.div>
  );
}

function LeaderboardSection({ myReferralCode }: { myReferralCode?: string }) {
  const { data: entries = [], isLoading } = useReferralLeaderboardQuery();

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="rounded-3xl border border-black/6 bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)] overflow-hidden"
    >
      <div className="flex items-center gap-3 px-5 py-4 sm:px-6">
        <div className="flex size-9 items-center justify-center rounded-full bg-amber-50">
          <Trophy className="size-4 text-amber-500" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Bảng xếp hạng</p>
          <p className="text-[11px] text-muted">Top người giới thiệu tháng này</p>
        </div>
      </div>
      <div className="px-4 pb-4 sm:px-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="size-5 animate-spin text-kun-primary" /></div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-surface-card"><Trophy className="size-5 text-muted" /></div>
            <p className="text-sm font-medium text-foreground">Chưa có ai lên bảng</p>
            <p className="text-xs text-muted">Hãy là người đầu tiên giới thiệu bạn bè!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, i) => (
              <LeaderboardRow key={entry.referralCode} entry={entry} isMe={!!myReferralCode && entry.referralCode === myReferralCode} index={i} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── CodeBox ───────────────────────────────────────────────────────────────────

function CodeBox({ code }: { code: string }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/register?ref=${code}`
      : `https://kunrituals.com/register?ref=${code}`;

  function copy(type: "code" | "link") {
    navigator.clipboard.writeText(type === "code" ? code : shareUrl).catch(() => null);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleNativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({
        title: "Mã giới thiệu UjCha",
        text: `Dùng mã ${code} khi đăng ký tại UjCha để nhận voucher chào mừng!`,
        url: shareUrl,
      }).catch(() => null);
    } else {
      copy("link");
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-kun-primary/20 bg-gradient-to-br from-kun-primary/[0.05] to-kun-primary/[0.01] px-5 py-4">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-kun-primary/50 to-transparent" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Mã của bạn</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="font-mono text-[22px] font-black tracking-[0.18em] text-foreground uppercase leading-none sm:text-[30px] sm:tracking-[0.22em]">
            {code}
          </p>
          <motion.button
            type="button"
            whileTap={{ scale: 0.93 }}
            onClick={() => copy("code")}
            className="flex shrink-0 items-center gap-2 rounded-full bg-kun-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 sm:px-5 sm:py-2.5 sm:text-[13px]"
          >
            <AnimatePresence mode="wait">
              {copied === "code" ? (
                <motion.span key="check" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
                  <Check className="size-3.5" /> Đã sao chép
                </motion.span>
              ) : (
                <motion.span key="copy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
                  <Copy className="size-3.5" /> Sao chép
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-black/8 bg-surface-soft px-3 py-2.5" style={{ minWidth: 0 }}>
          <Link2 className="size-3.5 shrink-0 text-muted" />
          <p className="min-w-0 flex-1 truncate text-[11px] text-muted">{shareUrl}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.93 }}
            onClick={() => copy("link")}
            className="flex items-center gap-1 rounded-full border border-black/10 bg-white px-3 py-2 text-[11px] font-semibold text-foreground transition hover:bg-surface-card"
          >
            {copied === "link" ? <Check className="size-3.5 text-kun-primary" /> : <Copy className="size-3" />}
            <span className="hidden sm:inline">{copied === "link" ? "Đã copy" : "Copy link"}</span>
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.93 }}
            onClick={handleNativeShare}
            className="flex items-center gap-1.5 rounded-full bg-kun-primary/10 px-3 py-2 text-[11px] font-semibold text-kun-primary transition hover:bg-kun-primary/15"
          >
            <Share2 className="size-3" /> Chia sẻ
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ── TierRewardCard ────────────────────────────────────────────────────────────

function TierRewardCard({ tier, successfulReferrals, claimed, onClaim, isClaiming }: {
  tier: Tier;
  successfulReferrals: number;
  claimed: boolean;
  onClaim: () => void;
  isClaiming: boolean;
}) {
  const Icon = tier.icon;
  const points = tier.points;
  const eligible = successfulReferrals >= tier.threshold;
  const remaining = tier.threshold - successfulReferrals;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-32px" }}
      className={`relative overflow-hidden rounded-2xl border transition-all ${eligible ? "border-black/8 bg-white shadow-[0_4px_24px_-8px_rgba(0,0,0,0.12)]" : "border-black/6 bg-surface-soft"}`}
    >
      <div className={`h-1.5 w-full bg-gradient-to-r ${tier.gradient} transition-opacity ${eligible ? "opacity-100" : "opacity-25"}`} />

      <div className="p-4">
        {claimed && (
          <span className="absolute right-3 top-5 flex size-5 items-center justify-center rounded-full bg-emerald-100">
            <Check className="size-3 text-emerald-600" />
          </span>
        )}

        <div className={`flex size-11 items-center justify-center rounded-xl bg-gradient-to-br ${tier.gradient} shadow-sm transition-opacity ${eligible ? "opacity-100" : "opacity-35"}`}>
          <Icon className="size-5 text-white" />
        </div>

        <p className={`mt-3 font-bold leading-tight ${eligible ? tier.activeText : "text-foreground"}`}>{tier.label}</p>
        <p className="text-[11px] text-muted">{tier.threshold}+ lượt hợp lệ</p>

        <div className="mt-2.5">
          <p className="text-[18px] font-black tabular-nums text-foreground leading-none">
            +{points.toLocaleString("vi-VN")}
            <span className="ml-1 text-xs font-semibold text-muted">điểm</span>
          </p>
          {tier.id === "gold" && <p className="mt-0.5 text-[11px] text-muted">Danh hiệu Ambassador</p>}
          {tier.id === "diamond" && <p className="mt-0.5 text-[11px] text-muted">Ưu đãi VIP đặc biệt</p>}
        </div>

        {eligible && !claimed && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={onClaim}
            disabled={isClaiming}
            className={`mt-4 flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r ${tier.gradient} py-2.5 text-[12px] font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60`}
          >
            {isClaiming ? <Loader2 className="size-3.5 animate-spin" /> : <><Gift className="size-3.5" /> Nhận thưởng</>}
          </motion.button>
        )}

        {claimed && (
          <div className="mt-4 flex items-center justify-center gap-1.5 rounded-full bg-emerald-50 py-2 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="size-3.5" /> Đã nhận +{points.toLocaleString("vi-VN")} điểm
          </div>
        )}

        {!eligible && !claimed && (
          <p className="mt-4 text-center text-[11px] text-muted">Còn {remaining} lượt nữa</p>
        )}
      </div>
    </motion.div>
  );
}

// ── VoucherPill ───────────────────────────────────────────────────────────────

function VoucherPill({ item }: { item: MyVoucherItem }) {
  const v = item.voucher;
  const used = !!item.usedAt;
  const expired = v.isExpired;
  const available = !used && !expired && v.isActive;
  const label = v.discountType === "percent" ? `Giảm ${v.discountValue}%` : `Giảm ${fmtVnd(v.discountValue)}`;

  return (
    <div className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${available ? "border-kun-primary/20 bg-kun-primary/5" : "border-black/6 bg-surface-soft opacity-55"}`}>
      <Gift className={`size-4 shrink-0 ${available ? "text-kun-primary" : "text-muted"}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{v.name}</p>
        <p className={`text-[11px] ${available ? "text-kun-primary font-semibold" : "text-muted"}`}>{label}</p>
      </div>
      {used && <span className="shrink-0 rounded-full bg-surface-card px-2 py-0.5 text-[10px] font-medium text-muted">Đã dùng</span>}
      {!used && expired && <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-500">Hết hạn</span>}
      {available && <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Dùng được</span>}
    </div>
  );
}

// ── RewardRulesSection ────────────────────────────────────────────────────────

function RewardRulesSection({ cfg, rewardsToday, isLoggedIn }: { cfg: ReferralPublicConfig | null; rewardsToday: number; isLoggedIn: boolean }) {
  const commission = cfg?.referrerCommissionPercent ?? 5;
  const minOrder = cfg ? parseFloat(cfg.minOrderAmount) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-32px" }}
      className="rounded-3xl border border-black/6 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)] sm:p-6"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Quyền lợi chi tiết</p>
      <h2 className="mt-1.5 text-[18px] font-bold text-foreground">Ai nhận được gì?</h2>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-kun-primary/20 bg-kun-primary/[0.04] p-4">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-kun-primary/10">
              <UserCheck className="size-3.5 text-kun-primary" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-kun-primary">Người mời</p>
          </div>
          <div>
            <p className="text-3xl font-black tabular-nums leading-none text-kun-primary">{commission}%</p>
            <p className="mt-1 text-[11px] font-medium text-kun-primary/70">hoa hồng đơn đầu tiên</p>
          </div>
          <div className="rounded-xl bg-white/80 px-3 py-2.5 space-y-1">
            <p className="text-[11px] font-semibold text-foreground leading-snug">Điểm UjCha cộng ngay sau khi bạn bè hoàn thành đơn hàng đầu tiên</p>
            {minOrder > 0 && <p className="text-[10px] text-muted">Đơn tối thiểu {fmtVnd(minOrder)}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/50 p-4">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-amber-100">
              <UserPlus className="size-3.5 text-amber-600" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Bạn được mời</p>
          </div>
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100">
            <Gift className="size-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-900">Voucher chào mừng</p>
            <p className="mt-1 text-[11px] text-amber-700 leading-snug">Nhận ngay khi đăng ký thành công — áp dụng cho đơn hàng đầu tiên tại UjCha</p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-black/[0.06] bg-surface-soft px-4 py-4">
        <p className="text-xs font-semibold text-foreground">Điều kiện để lượt giới thiệu được tính:</p>
        <ul className="mt-3 space-y-2.5">
          {[
            { icon: CheckCircle2, cls: "bg-emerald-100", icls: "text-emerald-600", text: "Bạn bè là người dùng mới, chưa có tài khoản UjCha" },
            { icon: CheckCircle2, cls: "bg-emerald-100", icls: "text-emerald-600", text: "Xác minh số điện thoại thành công" },
            { icon: CheckCircle2, cls: "bg-emerald-100", icls: "text-emerald-600", text: `Hoàn thành đơn hàng đầu tiên${minOrder > 0 ? ` từ ${fmtVnd(minOrder)}` : ""}` },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <li key={i} className="flex items-center gap-2.5">
                <div className={`flex size-5 shrink-0 items-center justify-center rounded-full ${item.cls}`}><Icon className={`size-3 ${item.icls}`} /></div>
                <p className="text-xs text-muted">{item.text}</p>
              </li>
            );
          })}
          {cfg?.blockSameIpAsReferrer && (
            <li className="flex items-center gap-2.5">
              <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-100"><Wifi className="size-3 text-amber-600" /></div>
              <p className="text-xs text-muted">Đăng ký từ <span className="font-semibold text-foreground/70">mạng khác</span> với người mời (không cùng WiFi / IP)</p>
            </li>
          )}
          {cfg?.blockSameDeviceAsReferrer && (
            <li className="flex items-center gap-2.5">
              <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-100"><Smartphone className="size-3 text-amber-600" /></div>
              <p className="text-xs text-muted">Đăng ký từ <span className="font-semibold text-foreground/70">thiết bị riêng</span> (không cùng điện thoại / máy tính)</p>
            </li>
          )}
          <li className="flex items-center gap-2.5">
            <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sky-100"><ShoppingBag className="size-3 text-sky-600" /></div>
            <p className="text-xs text-muted">Mỗi tài khoản chỉ ghi nhận mã giới thiệu <span className="font-semibold text-foreground/70">một lần duy nhất</span> khi đăng ký</p>
          </li>
        </ul>

        {isLoggedIn && cfg && cfg.maxReferrerRewardsPerDay > 0 && (() => {
          const limit = cfg.maxReferrerRewardsPerDay;
          const used = rewardsToday;
          const remaining = Math.max(0, limit - used);
          const pct = Math.min(100, (used / limit) * 100);
          const isFull = used >= limit;
          return (
            <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/70 px-4 py-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="size-3.5 shrink-0 text-violet-600" />
                  <p className="text-xs font-semibold text-violet-800">Hạn mức hôm nay</p>
                </div>
                <p className={`text-xs font-bold tabular-nums ${isFull ? "text-red-600" : "text-violet-700"}`}>{used} / {limit} lượt</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-violet-100">
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: "easeOut" }} className={`h-full rounded-full ${isFull ? "bg-red-400" : "bg-violet-500"}`} />
              </div>
              <p className={`text-[11px] ${isFull ? "font-semibold text-red-600" : "text-violet-600"}`}>
                {isFull ? "Đã đạt giới hạn hôm nay — reset lúc 0:00 UTC" : `Còn ${remaining} lượt thưởng trong ngày hôm nay`}
              </p>
            </div>
          );
        })()}
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-3">
        <Trophy className="mt-0.5 size-4 shrink-0 text-violet-500" />
        <p className="text-xs text-violet-800 leading-snug">Càng mời nhiều bạn hợp lệ, bạn đạt mốc thưởng <strong>Đồng → Bạc → Vàng → Kim cương</strong> và nhận thêm điểm milestone thưởng một lần.</p>
      </div>
    </motion.div>
  );
}

// ── main shell ────────────────────────────────────────────────────────────────

export function ReferralPageShell() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { data: profile, isLoading: profileLoading } = useProfileQuery();
  const { data: stats, isLoading: statsLoading } = useReferralStatsQuery();
  const { data: vouchers = [] } = useMyVouchersQuery();
  const { data: claimedTiers = [] } = useClaimedMilestonesQuery();
  const claimMutation = useClaimMilestoneMutation();
  const [claimingTier, setClaimingTier] = useState<MilestoneTierId | null>(null);
  const [claimSuccess, setClaimSuccess] = useState<{ tier: string; points: number } | null>(null);

  const referralVouchers = vouchers.filter((v) => v.source === "referral");
  const inviteCount = stats?.inviteCount ?? 0;
  const pointsEarned = stats?.pointsEarned ?? 0;
  const successfulReferrals = stats?.successfulReferrals ?? 0;
  const rewardsToday = stats?.rewardsToday ?? 0;
  const cfg = stats?.programConfig ?? null;

  const tiers = buildTiers(cfg);
  const currentTier = getCurrentTier(successfulReferrals, tiers);
  const isLoading = accessToken && (profileLoading || statsLoading);

  function handleClaim(tier: MilestoneTierId) {
    if (claimMutation.isPending) return;
    setClaimingTier(tier);
    claimMutation.mutate(tier, {
      onSuccess: (data) => {
        const tierLabel = tiers.find((t) => t.id === tier)?.label ?? tier;
        setClaimSuccess({ tier: tierLabel, points: data.points });
        setTimeout(() => setClaimSuccess(null), 4000);
      },
      onSettled: () => setClaimingTier(null),
    });
  }

  return (
    <div className="min-h-screen bg-surface-soft">

      {/* Claim success toast */}
      <AnimatePresence>
        {claimSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="fixed left-1/2 top-4 z-50 -translate-x-1/2"
          >
            <div className="flex items-center gap-3 rounded-full bg-[#1a3c34] px-5 py-3 shadow-xl">
              <span className="flex size-6 items-center justify-center rounded-full bg-white/20">
                <Sparkles className="size-3.5 text-white" />
              </span>
              <p className="text-sm font-semibold text-white">
                Nhận thưởng {claimSuccess.tier} thành công! +{claimSuccess.points.toLocaleString("vi-VN")} điểm
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1a3c34] via-[#1e4438] to-[#112a21] pb-20 pt-16 sm:pb-24 sm:pt-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 size-72 rounded-full bg-white/[0.03] blur-3xl" />
          <div className="absolute -bottom-16 left-1/4 size-96 rounded-full bg-[#99d6b3]/[0.06] blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "40px 40px" }}
          />
        </div>

        <div className="relative container mx-auto max-w-[72rem] px-4 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
              <Trophy className="size-8 text-white" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">Affiliate Program</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-5xl">
              Giới thiệu & kiếm thưởng
            </h1>
            <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-white/60">
              Mời bạn bè — cả hai nhận ưu đãi. Càng mời nhiều, cấp càng cao.
            </p>
          </motion.div>

          {accessToken && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="mt-10 flex items-center justify-center gap-8 sm:gap-14"
            >
              {isLoading ? (
                <Loader2 className="size-6 animate-spin text-white/50" />
              ) : (
                <>
                  <StatPill icon={Users} value={inviteCount} label="Đã mời" delay={0.14} />
                  <div className="h-12 w-px bg-white/15" />
                  <StatPill icon={Sparkles} value={pointsEarned.toLocaleString("vi-VN")} label="Điểm tích lũy" delay={0.18} />
                  <div className="h-12 w-px bg-white/15" />
                  <StatPill icon={CheckCircle2} value={successfulReferrals} label="Thành công" delay={0.22} />
                </>
              )}
            </motion.div>
          )}

          {accessToken && currentTier && !isLoading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.28, type: "spring", stiffness: 200 }}
              className="mt-6 flex justify-center"
            >
              <div className={`flex items-center gap-2 rounded-full bg-gradient-to-r ${currentTier.gradient} px-5 py-2 shadow-lg`}>
                {(() => { const CIcon = currentTier.icon; return <CIcon className="size-4 text-white" />; })()}
                <span className="text-xs font-bold uppercase tracking-wider text-white">{currentTier.label}</span>
              </div>
            </motion.div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 40" fill="none" className="w-full">
            <path d="M0 40 C360 0 1080 0 1440 40 L1440 40 L0 40Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* Body */}
      <div className="container mx-auto max-w-[72rem] px-4 pb-20 pt-6 lg:px-8">

        {/* Two-column: main content + leaderboard sidebar */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">

          {/* Left / main column */}
          <div className="min-w-0 flex-1 space-y-5">

            {/* Referral code */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 }}
              className="rounded-3xl border border-black/6 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)] sm:p-6"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Mã giới thiệu của bạn</p>
              {!accessToken ? (
                <div className="mt-4 flex flex-col items-center gap-3 py-4 text-center">
                  <Share2 className="size-8 text-kun-primary/40" />
                  <p className="text-sm text-muted">Đăng nhập để lấy mã giới thiệu và bắt đầu nhận thưởng.</p>
                  <Link href={ROUTES.LOGIN} className="mt-1 inline-flex items-center gap-2 rounded-full bg-kun-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90">
                    Đăng nhập ngay <ChevronRight className="size-4" />
                  </Link>
                </div>
              ) : profileLoading ? (
                <div className="mt-4 flex justify-center py-6"><Loader2 className="size-6 animate-spin text-kun-primary" /></div>
              ) : profile ? (
                <div className="mt-3">
                  <CodeBox code={profile.referralCode} />
                  <p className="mt-2 text-[11px] text-muted">Bạn bè nhập mã hoặc nhấp link khi đăng ký để cả hai nhận thưởng.</p>
                </div>
              ) : null}
            </motion.div>

            {/* Fraud warnings */}
            {cfg && (cfg.blockSameIpAsReferrer || cfg.blockSameDeviceAsReferrer) && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <FraudWarningBanners blockIp={cfg.blockSameIpAsReferrer} blockDevice={cfg.blockSameDeviceAsReferrer} />
              </motion.div>
            )}

            {/* Milestone track */}
            {accessToken && !statsLoading && (
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
                <MilestoneTrack successfulReferrals={successfulReferrals} tiers={tiers} />
              </motion.div>
            )}

            {/* Invitations */}
            {accessToken && (
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
                <InvitationsSection />
              </motion.div>
            )}
          </div>

          {/* Right / leaderboard sidebar */}
          <div className="w-full lg:w-[340px] lg:shrink-0 lg:sticky lg:top-20">
            <LeaderboardSection myReferralCode={profile?.referralCode} />
          </div>
        </div>

        {/* Full-width sections */}
        <div className="mt-6 space-y-5">

          {/* How it works + Reward rules: side by side on lg */}
          <div className="grid gap-5 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-32px" }}
              className="rounded-3xl border border-black/6 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)] sm:p-6"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Cách thức hoạt động</p>
              <h2 className="mt-1.5 text-[18px] font-bold text-foreground">3 bước đơn giản</h2>
              <div className="mt-5">
                {[
                  { icon: Share2, title: "Chia sẻ mã", desc: "Sao chép link hoặc mã và gửi cho bạn bè qua bất kỳ kênh nào.", color: "bg-kun-primary/10 text-kun-primary" },
                  { icon: UserPlus, title: "Bạn bè đăng ký", desc: "Họ nhấp link và tạo tài khoản — mã giới thiệu tự động được ghi nhận.", color: "bg-sky-50 text-sky-600" },
                  {
                    icon: Gift,
                    title: "Cả hai nhận thưởng",
                    desc: cfg
                      ? `Bạn nhận ${cfg.referrerCommissionPercent}% giá trị đơn đầu tiên của bạn bè quy thành điểm UjCha${parseFloat(cfg.minOrderAmount) > 0 ? ` (đơn từ ${fmtVnd(cfg.minOrderAmount)})` : ""}. Bạn bè nhận voucher chào mừng ngay khi đăng ký.`
                      : "Bạn nhận hoa hồng % đơn đầu tiên của bạn bè, bạn bè nhận voucher chào mừng.",
                    color: "bg-amber-50 text-amber-600",
                  },
                ].map((step, i) => {
                  const Icon = step.icon;
                  const isLast = i === 2;
                  return (
                    <motion.div
                      key={step.title}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.08 }}
                      className="flex gap-4"
                    >
                      <div className="relative flex flex-col items-center">
                        <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${step.color}`}>
                          <Icon className="size-4" />
                        </div>
                        {!isLast && <div className="mt-2 w-px flex-1 border-l-2 border-dashed border-black/[0.09]" style={{ minHeight: "36px" }} />}
                      </div>
                      <div className={`min-w-0 flex-1 ${isLast ? "pb-1" : "pb-7"}`}>
                        <div className="flex items-center gap-2 pt-1.5">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-card text-[10px] font-bold text-muted">{i + 1}</span>
                          <p className="font-semibold text-foreground">{step.title}</p>
                        </div>
                        <p className="ml-7 mt-1 text-sm leading-relaxed text-muted">{step.desc}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            <RewardRulesSection cfg={cfg} rewardsToday={rewardsToday} isLoggedIn={!!accessToken} />
          </div>

          {/* Tier reward cards: 4-col on sm+ */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Trophy className="size-4 text-kun-primary" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Mốc thưởng affiliate</p>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {tiers.map((tier) => (
                <TierRewardCard
                  key={tier.id}
                  tier={tier}
                  successfulReferrals={successfulReferrals}
                  claimed={claimedTiers.includes(tier.id)}
                  onClaim={() => handleClaim(tier.id)}
                  isClaiming={claimingTier === tier.id}
                />
              ))}
            </div>
          </div>

          {/* Referral vouchers */}
          {accessToken && referralVouchers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-32px" }}
              className="rounded-3xl border border-black/6 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)] sm:p-6"
            >
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Voucher giới thiệu của bạn</p>
              <div className="space-y-2">
                {referralVouchers.map((item) => <VoucherPill key={item.id} item={item} />)}
              </div>
            </motion.div>
          )}

          {/* Terms */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-black/6 bg-surface-soft px-5 py-4"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Điều kiện chương trình</p>
            <ul className="mt-2 space-y-1.5 text-xs text-muted">
              <li>• Bạn bè phải là tài khoản mới, chưa đăng ký tại UjCha.</li>
              <li>• Phần thưởng cộng sau khi bạn bè hoàn thành đơn đầu tiên{cfg && parseFloat(cfg.minOrderAmount) > 0 ? ` tối thiểu ${fmtVnd(cfg.minOrderAmount)}` : ""}.</li>
              {cfg?.blockSameIpAsReferrer && (
                <li className="flex items-start gap-1.5">
                  <ShieldAlert className="mt-0.5 size-3 shrink-0 text-amber-500" />
                  <span>Không hợp lệ nếu bạn bè đăng ký từ cùng địa chỉ mạng (IP) với bạn.</span>
                </li>
              )}
              {cfg?.blockSameDeviceAsReferrer && (
                <li className="flex items-start gap-1.5">
                  <ShieldAlert className="mt-0.5 size-3 shrink-0 text-amber-500" />
                  <span>Không hợp lệ nếu bạn bè đăng ký từ cùng thiết bị với bạn.</span>
                </li>
              )}
              <li>• Mỗi tài khoản chỉ nhập mã giới thiệu một lần khi đăng ký.</li>
              <li>• UjCha có quyền điều chỉnh chương trình mà không cần báo trước.</li>
            </ul>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
