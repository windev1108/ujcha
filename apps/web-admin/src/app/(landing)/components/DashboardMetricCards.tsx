"use client";

import { Link } from "@heroui/react";

import { formatVnd } from "@/lib/product-display";
import { ROUTES } from "@/lib/routes";
import type { AdminOverviewDashboard } from "@/services/admin/types";

import { formatCompactCount, formatPctChange } from "./dashboard-utils";
import { MetricCard } from "./MetricCard";

type Props = {
  data: AdminOverviewDashboard | undefined;
  isLoading: boolean;
};

function UsersIconStack() {
  return (
    <div className="flex -space-x-2 pt-1">
      {["K", "U", "N"].map((initials) => (
        <span
          key={initials}
          className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-[#d1fae5] text-[10px] font-bold text-[#14532d]"
        >
          {initials}
        </span>
      ))}
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-[140px] animate-pulse rounded-2xl bg-black/[0.06] ring-1 ring-black/[0.04]"
        />
      ))}
    </div>
  );
}

export function DashboardMetricCards({ data, isLoading }: Props) {
  if (isLoading || !data) {
    return <SkeletonCards />;
  }

  const s = data.summary;

  const platformBreakdown = s.revenue.platformBreakdown ?? {};
  const hasPlatform = Object.keys(platformBreakdown).length > 0;
  const PLATFORM_LABEL: Record<string, string> = { grab: "Grab", shopee: "Shopee" };
  const PLATFORM_COLOR: Record<string, string> = {
    grab: "text-green-700 bg-green-50",
    shopee: "text-orange-700 bg-orange-50",
  };

  const revenueExtra = hasPlatform ? (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {s.revenue.systemRevenue !== undefined && (
        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 tabular-nums">
          Quán {formatVnd(s.revenue.systemRevenue)}
        </span>
      )}
      {Object.entries(platformBreakdown).map(([p, v]) => (
        <span
          key={p}
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${PLATFORM_COLOR[p] ?? "text-gray-600 bg-gray-100"}`}
        >
          {PLATFORM_LABEL[p] ?? p.toUpperCase()} {formatVnd(v)}
        </span>
      ))}
    </div>
  ) : undefined;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard
        title="Doanh thu (đã TT)"
        value={formatVnd(s.revenue.current)}
        badge={formatPctChange(s.revenue.changePercent)}
        progress={
          s.revenue.previous > 0
            ? Math.min(1, s.revenue.current / (s.revenue.previous * 2))
            : undefined
        }
        extra={revenueExtra}
      />
      <MetricCard
        title="Số đơn hàng"
        value={String(s.orders.current)}
        badge={formatPctChange(s.orders.changePercent)}
        subtitle={`kỳ trước: ${s.orders.previous} đơn`}
      />
      <MetricCard
        title="Người dùng mới"
        value={String(s.newUsers.current)}
        badge={formatPctChange(s.newUsers.changePercent)}
        extra={<UsersIconStack />}
      />
      <MetricCard
        title="Giới thiệu (đăng ký)"
        value={String(s.referrals.current)}
        badge={formatPctChange(s.referrals.changePercent)}
        badgeVariant="outline"
        extra={
          <Link
            href={ROUTES.REFERRALS}
            className="text-xs font-medium text-[#1a3c34] underline-offset-4 hover:underline"
          >
            Xem chương trình giới thiệu
          </Link>
        }
      />
      <MetricCard
        title="Điểm UjCha đã cấp"
        value={formatCompactCount(s.pointsIssued)}
        variant="accent"
        badge="7 ngày"
        badgeVariant="neutral"
      />
    </div>
  );
}
