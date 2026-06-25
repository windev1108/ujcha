"use client";

import { Card, CardContent } from "@heroui/react";
import {
  Banknote,
  CheckCircle2,
  ClipboardClock,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";

type Props = {
  totalRevenue: number;
  totalOrders: number;
  activeOrders: number;
  avgOrderValue: number;
  fulfillmentSuccessPercent: number;
  isLoading?: boolean;
};

function formatVndNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(n))} VND`;
}

export function OrderStats({
  totalRevenue,
  totalOrders,
  activeOrders,
  avgOrderValue,
  fulfillmentSuccessPercent,
  isLoading,
}: Props) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card
            key={i}
            className="rounded-2xl border border-black/6 bg-white/80"
          >
            <CardContent className="p-5">
              <div className="h-20 animate-pulse rounded-xl bg-black/5" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <Card className="rounded-2xl border border-black/6 bg-white shadow-[0_8px_32px_-20px_rgba(0,0,0,0.12)]">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
              Tổng đơn hàng
            </span>
            <span className="flex size-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
              <ShoppingCart className="size-4" aria-hidden />
            </span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-[#1a3c34]">
            {totalOrders.toLocaleString("vi-VN")}
          </p>
          <p className="text-xs font-medium text-foreground/50">Khớp bộ lọc hiện tại</p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-black/6 bg-white shadow-[0_8px_32px_-20px_rgba(0,0,0,0.12)]">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
              Doanh thu (khoảng lọc)
            </span>
            <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-[#1a3c34]">
              <Banknote className="size-4" aria-hidden />
            </span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-[#1a3c34]">
            {formatVndNumber(totalRevenue)}
          </p>
          <p className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <TrendingUp className="size-3.5" aria-hidden />
            Đơn đã thanh toán trong khoảng
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-black/6 bg-white shadow-[0_8px_32px_-20px_rgba(0,0,0,0.12)]">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
              Đơn đang xử lý
            </span>
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#f0fdf4] text-[#1a3c34]">
              <ClipboardClock className="size-4" aria-hidden />
            </span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-[#1a3c34]">
            {activeOrders}
          </p>
          <p className="text-xs font-medium text-foreground/50">Live</p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-black/6 bg-white shadow-[0_8px_32px_-20px_rgba(0,0,0,0.12)]">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
              Giá trị TB / đơn đã TT
            </span>
            <span className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <TrendingUp className="size-4" aria-hidden />
            </span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-[#1a3c34]">
            {formatVndNumber(avgOrderValue)}
          </p>
          <p className="text-xs font-medium text-foreground/50">Avg</p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-[#1a3c34]/25 bg-[#1a3c34] text-white shadow-[0_12px_40px_-24px_rgba(26,60,52,0.45)]">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">
              Tỉ lệ hoàn thành
            </span>
            <span className="flex size-9 items-center justify-center rounded-xl bg-white/15 text-white">
              <CheckCircle2 className="size-4" aria-hidden />
            </span>
          </div>
          <p className="text-2xl font-bold tabular-nums">
            {Number.isFinite(fulfillmentSuccessPercent)
              ? `${fulfillmentSuccessPercent}%`
              : "—"}
          </p>
          <p className="text-xs font-medium text-white/70">
            Hoàn thành / (Hoàn thành + Hủy)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
