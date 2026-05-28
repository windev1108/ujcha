"use client";

import { Button, Label, ListBox, Select } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Filter, LogIn, LogOut, MapPin, RefreshCw } from "lucide-react";
import { useState } from "react";

import { OrderDateRangePicker } from "@/app/orders/components/OrderDateRangePicker";
import {
  adminLabelClassFilter,
  adminSelectTriggerClass,
  adminSelectValueClass,
} from "@/lib/admin-form-classes";
import { fetchAttendanceDailySummary, fetchShiftConfig, fetchStaffWithProfiles } from "@/services/admin/hrm-api";
import {
  getCheckinStatus,
  getCheckoutStatus,
  minutesToTimeStr,
  type ShiftConfig,
  type ShiftStatus,
} from "@/lib/shift-utils";
import type { DailySummaryItem } from "@/services/admin/types";

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayISO() { return toISO(new Date()); }

function thisWeekRange() {
  const now = new Date();
  const diffToMonday = now.getDay() === 0 ? -6 : 1 - now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() + diffToMonday);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { from: toISO(mon), to: toISO(sun) };
}

function thisMonthRange() {
  const now = new Date();
  return {
    from: toISO(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toISO(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function fmtMinutes(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h} giờ`;
  return `${h} giờ ${m} phút`;
}

function mapsUrl(lat: number | null, lng: number | null) {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

function fmtDate(ymd: string) {
  const [y, mo, d] = ymd.split("-");
  return `${d}/${mo}/${y}`;
}

function GpsLink({ lat, lng, dist }: { lat: number | null; lng: number | null; dist: number | null }) {
  const url = mapsUrl(lat, lng);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 text-[11px] text-foreground/40 hover:text-sky-600 transition-colors"
    >
      <MapPin className="size-3 shrink-0" />
      {dist != null ? `${Math.round(dist)}m` : `${lat?.toFixed(4)}, ${lng?.toFixed(4)}`}
    </a>
  );
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
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      {status.label}
    </span>
  );
}

function StaffRow({ item, shiftConfig }: { item: DailySummaryItem; shiftConfig: ShiftConfig | undefined }) {
  const displayName = item.admin.name ?? item.admin.email.split("@")[0];
  const role = item.admin.role === "super_admin" ? "Super" : "Staff";
  const allDone = item.pairs.every((p) => p.checkout !== null);

  // Compute total including in-progress pair
  const effectiveMinutes = item.pairs.reduce((sum, p) => {
    const end = p.checkout ? new Date(p.checkout.createdAt) : new Date();
    return sum + Math.max(0, Math.round((end.getTime() - new Date(p.checkin.createdAt).getTime()) / 60000));
  }, 0);

  return (
    <tr className="border-t border-black/5 align-top transition-colors hover:bg-black/[0.015]">
      {/* Staff */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          {item.admin.faceImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.admin.faceImageUrl}
              alt={displayName}
              className="size-10 shrink-0 rounded-xl object-cover ring-1 ring-black/8"
            />
          ) : (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f0ee] text-sm font-bold text-[#1a3c34]">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">{displayName}</span>
            <span className="text-[11px] text-foreground/40">{item.admin.email.split("@")[0]} · {role}</span>
          </div>
        </div>
      </td>

      {/* Date */}
      <td className="whitespace-nowrap px-5 py-4 text-sm tabular-nums text-foreground/70">
        {fmtDate(item.date)}
      </td>

      {/* Sessions with GPS */}
      <td className="px-5 py-4">
        <div className="flex flex-col gap-2.5">
          {item.pairs.map((pair, i) => {
            const checkinStatus = shiftConfig ? getCheckinStatus(pair.checkin.createdAt, shiftConfig) : null;
            const checkoutStatus = pair.checkout && shiftConfig ? getCheckoutStatus(pair.checkout.createdAt, shiftConfig) : null;
            return (
              <div key={pair.checkin.id} className="flex flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span className="w-8 text-[10px] font-bold uppercase tracking-wider text-foreground/30">Ca {i + 1}</span>
                  {/* Check-in */}
                  <div className="flex flex-col gap-0.5">
                    <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
                      <LogIn className="size-3.5 shrink-0" />
                      <span className="font-semibold tabular-nums">{fmtTime(pair.checkin.createdAt)}</span>
                      {checkinStatus && <ShiftBadge status={checkinStatus} />}
                    </span>
                    <GpsLink lat={pair.checkin.lat} lng={pair.checkin.lng} dist={pair.checkin.distanceMeters} />
                  </div>
                  {/* Check-out */}
                  {pair.checkout ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="inline-flex items-center gap-1 text-sm text-sky-600">
                        <LogOut className="size-3.5 shrink-0" />
                        <span className="font-semibold tabular-nums">{fmtTime(pair.checkout.createdAt)}</span>
                        {checkoutStatus && <ShiftBadge status={checkoutStatus} />}
                      </span>
                      <GpsLink lat={pair.checkout.lat} lng={pair.checkout.lng} dist={pair.checkout.distanceMeters} />
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-500">
                      <span className="inline-block size-1.5 animate-pulse rounded-full bg-amber-400" />
                      Đang làm
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </td>

      {/* Total hours */}
      <td className="whitespace-nowrap px-5 py-4">
        {effectiveMinutes > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <Clock className="size-3 shrink-0" />
            {fmtMinutes(effectiveMinutes)}
          </span>
        ) : (
          <span className="text-xs text-foreground/30">—</span>
        )}
      </td>

      {/* Status */}
      <td className="px-5 py-4">
        {allDone ? (
          <span className="inline-block rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">Hoàn tất</span>
        ) : (
          <span className="inline-block rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Đang làm</span>
        )}
      </td>
    </tr>
  );
}

export function AttendanceTab() {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [staffId, setStaffId] = useState("");
  const [page, setPage] = useState(1);

  const staffQ = useQuery({
    queryKey: ["admin", "hrm", "staff"],
    queryFn: fetchStaffWithProfiles,
  });

  const shiftQ = useQuery({
    queryKey: ["admin", "hrm", "shift-config"],
    queryFn: fetchShiftConfig,
  });

  const summaryQ = useQuery({
    queryKey: ["admin", "hrm", "attendance", "daily-summary", { from, to, staffId, page }],
    queryFn: () =>
      fetchAttendanceDailySummary({
        from,
        to,
        adminId: staffId || undefined,
        page,
        pageSize: 20,
      }),
  });

  const items = summaryQ.data?.items ?? [];
  const total = summaryQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="rounded-2xl border border-black/6 bg-white p-4 shadow-sm">
        {/* Quick filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground/55">
            <Filter className="size-3.5" />
            Lọc nhanh
          </span>
          <Button size="sm" variant="ghost" className="rounded-full text-xs"
            onPress={() => { const t = todayISO(); setFrom(t); setTo(t); setPage(1); }}>
            Hôm nay
          </Button>
          <Button size="sm" variant="ghost" className="rounded-full text-xs"
            onPress={() => { const r = thisWeekRange(); setFrom(r.from); setTo(r.to); setPage(1); }}>
            Tuần này
          </Button>
          <Button size="sm" variant="ghost" className="rounded-full text-xs"
            onPress={() => { const r = thisMonthRange(); setFrom(r.from); setTo(r.to); setPage(1); }}>
            Tháng này
          </Button>
          <div className="ml-auto">
            <Button
              variant="ghost"
              className="rounded-xl"
              onPress={() => void summaryQ.refetch()}
              isDisabled={summaryQ.isFetching}
            >
              <RefreshCw className="mr-2 size-4" />
              Làm mới
            </Button>
          </div>
        </div>

        {/* Date range + staff filter */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="">
            <OrderDateRangePicker
              label="Khoảng ngày"
              from={from}
              to={to}
              onRangeChange={(f, t) => { setFrom(f); setTo(t); setPage(1); }}
              className="w-full"
            />
          </div>
          <div className="flex min-w-[200px] flex-col gap-2.5">
            <Label className={adminLabelClassFilter}>Nhân viên</Label>
            <Select
              className="w-full"
              value={staffId || "__all__"}
              onChange={(key) => {
                const k = key == null ? "__all__" : String(key);
                setStaffId(k === "__all__" ? "" : k);
                setPage(1);
              }}
              variant="secondary"
            >
              <Select.Trigger className={adminSelectTriggerClass}>
                <Select.Value className={adminSelectValueClass} />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover placement="bottom start">
                <ListBox className="max-h-60 min-w-(--trigger-width) overflow-y-auto outline-none">
                  <ListBox.Item id="__all__" textValue="Tất cả" className="rounded-lg text-sm">
                    Tất cả
                  </ListBox.Item>
                  {(staffQ.data ?? []).map((s) => (
                    <ListBox.Item
                      key={s.id}
                      id={s.id}
                      textValue={s.name ?? s.email.split("@")[0]}
                      className="rounded-lg text-sm"
                    >
                      <span>{s.name ?? s.email.split("@")[0]}</span>
                      <span className="ml-1.5 text-foreground/40">
                        {s.role === "super_admin" ? "Super Admin" : "Staff"}
                      </span>
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        </div>
      </div>

      {/* Shift info strip */}
      {shiftQ.data && (
        <div className="flex items-center gap-2 rounded-2xl border border-black/6 bg-white px-5 py-3 shadow-sm">
          <Clock className="size-4 text-[#1a3c34]" />
          <span className="text-sm text-foreground/60">
            Ca hiện tại:{" "}
            <strong className="text-foreground/80">
              {minutesToTimeStr(shiftQ.data.startMinutes)} – {minutesToTimeStr(shiftQ.data.endMinutes)}
            </strong>
            {shiftQ.data.toleranceMinutes > 0 && (
              <span className="ml-1 text-foreground/40">(±{shiftQ.data.toleranceMinutes} phút)</span>
            )}
          </span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-black/6 bg-white shadow-sm">
        <table className="w-full min-w-[680px] border-collapse">
          <thead>
            <tr className="border-b border-black/6">
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/45">Nhân viên</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/45">Ngày</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/45">Ca làm việc</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/45">Tổng giờ</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/45">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {summaryQ.isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-black/5">
                  {Array.from({ length: 5 }).map((__, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 animate-pulse rounded bg-black/5" />
                    </td>
                  ))}
                </tr>
              ))
              : items.length === 0
                ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-foreground/40">
                      Không có dữ liệu chấm công.
                    </td>
                  </tr>
                )
                : items.map((item) => (
                  <StaffRow key={`${item.adminId}|${item.date}`} item={item} shiftConfig={shiftQ.data} />
                ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-black/6 px-5 py-3">
            <p className="text-xs text-foreground/50">Tổng {total} nhóm</p>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" isDisabled={page <= 1} onPress={() => setPage((n) => n - 1)}>←</Button>
              <span className="px-3 py-1 text-sm">{page}/{totalPages}</span>
              <Button size="sm" variant="ghost" isDisabled={page >= totalPages} onPress={() => setPage((n) => n + 1)}>→</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
