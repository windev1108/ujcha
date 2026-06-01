"use client";

import { Card, CardContent } from "@heroui/react";
import { Bike, Gauge, Truck, Users } from "lucide-react";

type Props = {
  totalActive: number;
  availableNow: number;
  avgDeliveryMinutes: number | null;
  isLoading?: boolean;
};

export function ShipperStats({
  totalActive,
  availableNow,
  avgDeliveryMinutes,
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

  const avgLabel =
    avgDeliveryMinutes != null && Number.isFinite(avgDeliveryMinutes)
      ? `${avgDeliveryMinutes} phút`
      : "—";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card className="rounded-2xl border border-black/6 bg-white shadow-[0_8px_32px_-20px_rgba(0,0,0,0.12)]">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
              Shipper đang bật
            </span>
            <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-[#1a3c34]">
              <Users className="size-4" aria-hidden />
            </span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-[#1a3c34]">
            {totalActive}
          </p>
          <p className="text-xs text-foreground/50">Đang nhận đơn giao hàng</p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-[#1a3c34]/25 bg-[#1a3c34] text-white shadow-[0_12px_40px_-24px_rgba(26,60,52,0.45)]">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">
              Sẵn sàng ngay
            </span>
            <span className="flex size-9 items-center justify-center rounded-xl bg-white/15 text-white">
              <Bike className="size-4" aria-hidden />
            </span>
          </div>
          <p className="text-2xl font-bold tabular-nums">{availableNow}</p>
          <p className="text-xs text-white/80">
            Không bận đơn đang xử lý (pending…ready)
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-black/6 bg-white shadow-[0_8px_32px_-20px_rgba(0,0,0,0.12)]">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
              TB thời gian giao
            </span>
            <span className="flex size-9 items-center justify-center rounded-xl bg-black/[0.05] text-foreground/55">
              <Gauge className="size-4" aria-hidden />
            </span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-[#1a3c34]">
            {avgLabel}
          </p>
          <p className="text-xs text-foreground/50">
            Ước lượng từ đơn hoàn thành gần đây
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
