"use client";

import { CheckCircle2, Clock, LogIn, LogOut, MapPin } from "lucide-react";
import type { AttendanceTodayRecord } from "@/services/admin/types";
import {
  getCheckinStatus,
  getCheckoutStatus,
  minutesToTimeStr,
  type ShiftConfig,
  type ShiftStatus,
} from "@/lib/shift-utils";

type Props = {
  today: AttendanceTodayRecord | undefined;
  isLoading: boolean;
  faceImageUrl?: string | null;
  shiftConfig?: ShiftConfig;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtMinutes(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}g ${m}p` : `${m} phút`;
}

function ShiftBadge({ status }: { status: ShiftStatus }) {
  const cls = {
    on_time: "bg-emerald-50 text-emerald-700",
    early_arrive: "bg-emerald-50 text-emerald-700",
    late: "bg-red-50 text-red-600",
    early_leave: "bg-amber-50 text-amber-700",
    overtime: "bg-sky-50 text-sky-700",
  }[status.kind];

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {status.label}
    </span>
  );
}

export function AttendanceStatus({ today, isLoading, faceImageUrl, shiftConfig }: Props) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-black/6 bg-white p-5">
        <div className="h-4 w-32 animate-pulse rounded-full bg-black/5" />
        <div className="h-16 animate-pulse rounded-xl bg-black/5" />
      </div>
    );
  }

  const records = today?.records ?? [];
  const totalMinutes = today?.totalMinutes ?? 0;
  const lastType = today?.lastType ?? null;

  const pairs: Array<{ checkin: (typeof records)[0]; checkout: (typeof records)[0] | null }> = [];
  let pendingCheckin: (typeof records)[0] | null = null;
  for (const r of records) {
    if (r.type === "checkin") {
      pendingCheckin = r;
      pairs.push({ checkin: r, checkout: null });
    } else if (r.type === "checkout" && pendingCheckin) {
      pairs[pairs.length - 1]!.checkout = r;
      pendingCheckin = null;
    }
  }

  if (pairs.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-black/6 bg-white px-5 py-4">
        {faceImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={faceImageUrl} alt="avatar" className="size-12 shrink-0 rounded-xl object-cover ring-2 ring-white shadow-sm" />
        )}
        <div className="flex flex-col gap-0.5">
          <p className="text-sm text-foreground/40">Chưa có bản ghi chấm công hôm nay.</p>
          {shiftConfig && (
            <p className="text-[11px] text-foreground/30">
              Ca: {minutesToTimeStr(shiftConfig.startMinutes)} – {minutesToTimeStr(shiftConfig.endMinutes)}
              {shiftConfig.toleranceMinutes > 0 && ` (±${shiftConfig.toleranceMinutes} phút)`}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Effective total including in-progress pair
  const effectiveMinutes = pairs.reduce((sum, p) => {
    const end = p.checkout ? new Date(p.checkout.createdAt) : new Date();
    return sum + Math.max(0, Math.round((end.getTime() - new Date(p.checkin.createdAt).getTime()) / 60000));
  }, 0);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-black/6 bg-white p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        {faceImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={faceImageUrl} alt="avatar" className="size-12 shrink-0 rounded-xl object-cover ring-2 ring-white shadow-sm" />
        )}
        <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold text-[#1a3c34]">
              {lastType === "checkin" ? "Đang làm việc" : "Đã kết thúc ca"}
            </p>
            {shiftConfig && (
              <p className="text-[11px] text-foreground/40">
                Ca: {minutesToTimeStr(shiftConfig.startMinutes)} – {minutesToTimeStr(shiftConfig.endMinutes)}
              </p>
            )}
          </div>
          {effectiveMinutes > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <Clock className="size-3" />
              {fmtMinutes(effectiveMinutes)}
            </span>
          )}
        </div>
      </div>

      {/* Session list */}
      <div className="flex flex-col gap-2">
        {pairs.map((pair, i) => {
          const isActive = pair.checkout === null;
          const pairMins = pair.checkout
            ? Math.round((new Date(pair.checkout.createdAt).getTime() - new Date(pair.checkin.createdAt).getTime()) / 60000)
            : null;
          const checkinStatus = shiftConfig ? getCheckinStatus(pair.checkin.createdAt, shiftConfig) : null;
          const checkoutStatus = pair.checkout && shiftConfig ? getCheckoutStatus(pair.checkout.createdAt, shiftConfig) : null;

          return (
            <div
              key={pair.checkin.id}
              className={`flex flex-col gap-1.5 rounded-xl p-3 ${isActive ? "border border-emerald-100 bg-emerald-50" : "border border-black/5 bg-[#f8faf9]"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">Ca {i + 1}</span>
                <div className="flex items-center gap-2">
                  {pairMins !== null && (
                    <span className="text-[11px] text-foreground/50">{fmtMinutes(pairMins)}</span>
                  )}
                  {isActive && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                      <span className="inline-block size-1.5 animate-pulse rounded-full bg-emerald-500" />
                      Đang làm
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-5">
                {/* Check-in */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <LogIn className="size-3.5 shrink-0 text-emerald-600" />
                  <span className="font-semibold tabular-nums text-sm text-foreground/80">{fmt(pair.checkin.createdAt)}</span>
                  {pair.checkin.distanceMeters != null && (
                    <span className="flex items-center gap-0.5 text-[11px] text-foreground/40">
                      <MapPin className="size-3 shrink-0" />{Math.round(pair.checkin.distanceMeters)}m
                    </span>
                  )}
                  {checkinStatus && <ShiftBadge status={checkinStatus} />}
                </div>

                {/* Check-out */}
                {pair.checkout ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <LogOut className="size-3.5 shrink-0 text-sky-500" />
                    <span className="font-semibold tabular-nums text-sm text-foreground/80">{fmt(pair.checkout.createdAt)}</span>
                    {pair.checkout.distanceMeters != null && (
                      <span className="flex items-center gap-0.5 text-[11px] text-foreground/40">
                        <MapPin className="size-3 shrink-0" />{Math.round(pair.checkout.distanceMeters)}m
                      </span>
                    )}
                    {checkoutStatus && <ShiftBadge status={checkoutStatus} />}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-sm text-foreground/30">
                    <LogOut className="size-3.5 shrink-0" />
                    <span className="text-xs">Chưa check-out</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {totalMinutes > 0 && (
        <div className="flex items-center justify-end gap-1.5 border-t border-black/5 pt-2 text-xs text-foreground/50">
          <CheckCircle2 className="size-3.5 text-emerald-500" />
          Tổng làm việc:
          <span className="font-semibold text-foreground/70">{fmtMinutes(totalMinutes)}</span>
        </div>
      )}
    </div>
  );
}
