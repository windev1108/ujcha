"use client";

import { Card, CardContent } from "@heroui/react";
import { ClipboardList, LayoutGrid, Zap } from "lucide-react";

type Props = {
  totalTables: number;
  inUseCount: number;
  capacityPercent: number;
  newTablesThisWeek: number;
  tableOrdersCount: number;
  isLoading?: boolean;
};

export function TableStats({
  totalTables,
  inUseCount,
  capacityPercent,
  newTablesThisWeek,
  tableOrdersCount,
  isLoading,
}: Props) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card className="rounded-2xl border border-black/6 bg-white shadow-[0_8px_32px_-20px_rgba(0,0,0,0.12)]">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
              Tổng số bàn
            </span>
            <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-[#1a3c34]">
              <LayoutGrid className="size-4" aria-hidden />
            </span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-[#1a3c34]">
            {totalTables}
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold">
              +{newTablesThisWeek} tuần này
            </span>
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-black/6 bg-white shadow-[0_8px_32px_-20px_rgba(0,0,0,0.12)]">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
              Đang sử dụng
            </span>
            <span className="flex size-9 items-center justify-center rounded-xl bg-white/15 text-white">
              <Zap className="size-4" aria-hidden />
            </span>
          </div>
          <p className="text-2xl font-bold tabular-nums">{inUseCount}</p>
          <p className="inline-flex items-center gap-1 text-xs font-medium">
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold">
              {Number.isFinite(capacityPercent)
                ? `${capacityPercent}% capacity`
                : "—"}
            </span>
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-black/6 bg-white shadow-[0_8px_32px_-20px_rgba(0,0,0,0.12)]">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
              Đơn từ bàn
            </span>
            <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-[#1a3c34]">
              <ClipboardList className="size-4" aria-hidden />
            </span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-[#1a3c34]">
            {tableOrdersCount}
          </p>
          <p className="text-xs font-medium text-foreground/55">
            Tổng đơn đặt qua QR / tại bàn
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
