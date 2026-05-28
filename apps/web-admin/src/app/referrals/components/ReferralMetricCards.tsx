"use client";

import {
  ArrowUpRight,
  CheckCircle2,
  Sparkles,
  Star,
  UserPlus,
} from "lucide-react";

import { formatCompactCount, formatPctChange } from "@/app/(landing)/components/dashboard-utils";
import type { AdminReferralDashboard } from "@/services/admin/types";

type Props = {
  data: AdminReferralDashboard | undefined;
  isLoading: boolean;
};

type StatCardProps = {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  badge?: string;
  badgeClass?: string;
  sub: string;
  progress?: number;
  accentBar?: string;
};

function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  badge,
  badgeClass,
  sub,
  progress,
  accentBar,
}: StatCardProps) {
  return (
    <div className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.15)]">
      <div className="flex items-start justify-between gap-2">
        <div className={`flex size-9 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`size-4 ${iconColor}`} />
        </div>
        {badge && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}>
            {badge}
          </span>
        )}
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/45">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-[1.65rem]">
          {value}
        </p>
      </div>

      <p className="text-xs text-foreground/50 leading-snug">{sub}</p>

      {typeof progress === "number" && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-black/[0.06]">
          <div
            className={`h-full rounded-full transition-all ${accentBar ?? "bg-[#5a8f7a]"}`}
            style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
          />
        </div>
      )}
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-[148px] animate-pulse rounded-2xl bg-black/[0.06] ring-1 ring-black/[0.04]"
        />
      ))}
    </div>
  );
}

export function ReferralMetricCards({ data, isLoading }: Props) {
  if (isLoading || !data) return <SkeletonCards />;

  const s = data.stats;
  const momBadge = formatPctChange(s.referralSignupsMomPercent);
  const convText =
    s.conversionPercent != null ? `${s.conversionPercent}% chuyển đổi` : "—";
  const convProgress =
    s.conversionPercent != null
      ? Math.min(1, s.conversionPercent / 100)
      : undefined;

  const momPositive =
    s.referralSignupsMomPercent != null && s.referralSignupsMomPercent > 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={UserPlus}
        iconBg="bg-[#1a3c34]/10"
        iconColor="text-[#1a3c34]"
        label="Tổng lượt giới thiệu"
        value={formatCompactCount(s.totalReferralsAllTime)}
        badge={momBadge}
        badgeClass={
          momPositive
            ? "bg-emerald-100 text-emerald-800"
            : "bg-black/[0.05] text-foreground/60"
        }
        sub="So với cùng kỳ tháng trước (đăng ký qua mã)"
      />

      <StatCard
        icon={CheckCircle2}
        iconBg="bg-sky-50"
        iconColor="text-sky-600"
        label="Đơn đã thanh toán"
        value={String(s.successfulPaidOrders)}
        badge={convText}
        badgeClass="bg-sky-50 text-sky-700"
        sub="Khách được mời có ít nhất một đơn thanh toán"
        progress={convProgress}
        accentBar="bg-sky-400"
      />

      <StatCard
        icon={Star}
        iconBg="bg-amber-50"
        iconColor="text-amber-500"
        label="Điểm thưởng đã cấp"
        value={formatCompactCount(s.totalPointsRewarded)}
        sub="Tổng điểm từ nguồn giới thiệu (earn)"
        accentBar="bg-amber-400"
      />

      <StatCard
        icon={Sparkles}
        iconBg="bg-violet-50"
        iconColor="text-violet-500"
        label="Đăng ký tuần này"
        value={`+${s.newReferralSignupsThisWeek}`}
        badge="Tuần này"
        badgeClass="bg-violet-50 text-violet-700"
        sub="Thành viên mới có mã người giới thiệu (UTC)"
      />
    </div>
  );
}
