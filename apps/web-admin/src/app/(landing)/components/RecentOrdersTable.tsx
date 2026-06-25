"use client";

import { Download, MoreHorizontal } from "lucide-react";
import NextLink from "next/link";

import { Button, Card, CardContent, Link } from "@heroui/react";

import { formatVnd } from "@/lib/product-display";
import { ROUTES } from "@/lib/routes";
import type { AdminOrderStatus, AdminOverviewDashboard } from "@/services/admin/types";

import { orderStatusLabelVi } from "./dashboard-utils";

type Props = {
  data: AdminOverviewDashboard | undefined;
  isLoading: boolean;
};

function initialsFromName(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase();
  return (p[0]![0]! + p[p.length - 1]![0]!).toUpperCase();
}

function statusStyle(s: AdminOrderStatus): string {
  switch (s) {
    case "completed":
      return "bg-emerald-50 text-emerald-800 ring-emerald-600/15";
    case "cancelled":
      return "bg-red-50 text-red-800 ring-red-600/15";
    case "pending":
      return "bg-zinc-100 text-zinc-700 ring-black/8";
    case "preparing":
    case "ready":
      return "bg-amber-50 text-amber-900 ring-amber-600/15";
    default:
      return "bg-zinc-100 text-zinc-700 ring-black/8";
  }
}

export function RecentOrdersTable({ data, isLoading }: Props) {
  const rows = data?.recentOrders ?? [];
  const totalAll = data?.totalOrdersAllTime ?? 0;

  if (isLoading) {
    return (
      <Card className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_12px_40px_-24px_rgba(0,0,0,0.15)]">
        <CardContent className="h-64 animate-pulse p-6" />
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_12px_40px_-24px_rgba(0,0,0,0.15)]">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-4 sm:px-6">
          <p className="text-sm font-semibold text-foreground">
            Đơn gần đây
          </p>
          <span
            className="inline-flex"
            title="Tính năng xuất báo cáo sẽ cập nhật sau"
          >
            <Button
              variant="ghost"
              size="sm"
              isDisabled
              className="gap-2 rounded-full text-xs font-semibold text-foreground/35"
            >
              <Download className="size-4" />
              Xuất báo cáo
            </Button>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] bg-[#fafafa] text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                <th className="px-5 py-3 sm:px-6">Mã đơn hàng</th>
                <th className="px-5 py-3 sm:px-6">Khách</th>
                <th className="px-5 py-3 sm:px-6">Món đầu tiên</th>
                <th className="px-5 py-3 sm:px-6">Thành tiền</th>
                <th className="px-5 py-3 sm:px-6">Trạng thái</th>
                <th className="px-5 py-3 sm:px-6 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-black/[0.04] last:border-0"
                >
                  <td className="px-5 py-4 font-mono text-sm font-medium text-foreground sm:px-6">
                    {row.paymentCode}
                  </td>
                  <td className="px-5 py-4 sm:px-6">
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#bbf7d0] text-[10px] font-bold text-[#14532d]">
                        {initialsFromName(row.customerName)}
                      </span>
                      <span className="font-medium text-foreground">
                        {row.customerName}
                      </span>
                    </div>
                  </td>
                  <td className="max-w-[200px] truncate px-5 py-4 text-foreground/80 sm:px-6">
                    {row.firstItemName}
                  </td>
                  <td className="px-5 py-4 font-medium tabular-nums text-foreground sm:px-6">
                    {formatVnd(Number.parseFloat(row.finalAmount) || 0)}
                  </td>
                  <td className="px-5 py-4 sm:px-6">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusStyle(row.status)}`}
                    >
                      {orderStatusLabelVi(row.status)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right sm:px-6">
                    <NextLink
                      href={ROUTES.orderDetail(row.id)}
                      className="inline-flex size-9 items-center justify-center rounded-full text-foreground/50 transition-colors hover:bg-black/[0.04] hover:text-foreground"
                      aria-label="Chi tiết đơn"
                    >
                      <MoreHorizontal className="size-5" />
                    </NextLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-black/[0.06] px-5 py-4 text-center sm:px-6">
          <Link
            href={ROUTES.ORDERS}
            className="text-xs font-bold uppercase tracking-[0.2em] text-[#1a3c34] underline-offset-4 hover:underline"
          >
            Xem tất cả {totalAll.toLocaleString("vi-VN")} đơn
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
