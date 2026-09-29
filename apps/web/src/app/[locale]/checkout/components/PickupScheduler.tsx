"use client";

import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useStoreStatusQuery } from "@/services/store/hooks";

// ── constants ────────────────────────────────────────────────────────────────

// Thứ tự khớp với Date.getDay() (0 = Chủ nhật)
const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const SLOT_STEP_MIN = 30; // bước mỗi slot
const PREP_AFTER_OPEN_MIN = 30; // sau giờ mở cửa 30p mới nhận (thời gian chuẩn bị)
const CUTOFF_BEFORE_CLOSE_MIN = 30; // trước giờ đóng cửa 30p thì ngừng nhận
const LEAD_TIME_MIN = 15; // đặt sớm nhất sau bây giờ 15p

// ── helpers ──────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" theo giờ LOCAL (không dùng toISOString để tránh lệch UTC) */
function localDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayDate() {
  return localDateStr(new Date());
}

/** Tạo Date local từ "YYYY-MM-DD" + phút trong ngày */
function dateAtMinutes(dateStr: string, minutes: number): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0, 0);
}

function minutesToHHmm(min: number) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

function hhmmToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Sinh các slot hợp lệ trong khoảng:
 *   [openMinutes + 30, closeMinutes - 30], bước 30p, canh theo mốc :00 / :30
 */
function buildTimeSlots(openMinutes: number, closeMinutes: number): string[] {
  const earliest = openMinutes + PREP_AFTER_OPEN_MIN;
  const latest = closeMinutes - CUTOFF_BEFORE_CLOSE_MIN;

  const first = Math.ceil(earliest / SLOT_STEP_MIN) * SLOT_STEP_MIN;
  const slots: string[] = [];
  for (let m = first; m <= latest; m += SLOT_STEP_MIN) {
    slots.push(minutesToHHmm(m));
  }
  return slots;
}

/** Slot của 1 ngày cụ thể + trạng thái disabled (nếu là hôm nay thì chặn slot đã qua / < now + 15p) */
function getSlotsForDate(
  dateStr: string,
  baseSlots: string[],
  minMs: number,
): Array<{ time: string; disabled: boolean }> {
  const isToday = dateStr === todayDate();
  return baseSlots.map((time) => {
    const disabled = isToday
      ? dateAtMinutes(dateStr, hhmmToMinutes(time)).getTime() < minMs
      : false;
    return { time, disabled };
  });
}

/** First weekday (0=Sun) of a month */
function firstWeekday(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/** Days in month */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// ── component ─────────────────────────────────────────────────────────────────

type Props = {
  value: string; // ISO string or ""
  onChange: (iso: string) => void;
};

export function PickupScheduler({ value, onChange }: Props) {
  const t = useTranslations();
  const { data: storeStatus } = useStoreStatusQuery();

  const openMinutes = storeStatus?.openMinutes;
  const closeMinutes = storeStatus?.closeMinutes;

  const now = new Date();
  const minMs = now.getTime() + LEAD_TIME_MIN * 60_000; // earliest valid time

  // parse existing value
  const initDate = value ? localDateStr(new Date(value)) : "";
  const initTime = value ? new Date(value).toTimeString().slice(0, 5) : "";

  const [viewYear, setViewYear] = useState(() => now.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => now.getMonth()); // 0-based
  const [selDate, setSelDate] = useState(initDate);
  const [selTime, setSelTime] = useState(initTime);

  // ── slot hợp lệ theo giờ mở/đóng cửa ───────────────────────────────────────
  const baseSlots = useMemo(() => {
    if (openMinutes == null || closeMinutes == null) return [];
    return buildTimeSlots(openMinutes, closeMinutes);
  }, [openMinutes, closeMinutes]);

  // ── calendar grid ──────────────────────────────────────────────────────────
  const calDays = useMemo(() => {
    const padCells = firstWeekday(viewYear, viewMonth);
    const total = daysInMonth(viewYear, viewMonth);
    const today = todayDate();
    const cells: Array<{ day: number; dateStr: string; disabled: boolean } | null> = [];
    for (let i = 0; i < padCells; i++) cells.push(null);
    for (let d = 1; d <= total; d++) {
      const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`;
      let disabled = dateStr < today;
      // hôm nay mà không còn slot nào hợp lệ → khoá luôn ngày
      if (!disabled && dateStr === today) {
        disabled = getSlotsForDate(dateStr, baseSlots, minMs).every((s) => s.disabled);
      }
      cells.push({ day: d, dateStr, disabled });
    }
    return cells;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewYear, viewMonth, baseSlots]);

  // ── time slots for selected date ───────────────────────────────────────────
  const availableSlots = useMemo(() => {
    if (!selDate) return [];
    return getSlotsForDate(selDate, baseSlots, minMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selDate, baseSlots]);

  // Nếu giờ mở/đóng cửa đổi (admin sửa) hoặc slot đang chọn không còn hợp lệ → bỏ chọn
  useEffect(() => {
    if (!storeStatus || !selDate || !selTime) return;
    const slot = availableSlots.find((s) => s.time === selTime);
    if (!slot || slot.disabled) {
      setSelTime("");
      onChange("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableSlots, selTime, selDate, storeStatus]);

  // ── handlers ──────────────────────────────────────────────────────────────
  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  function pickDate(dateStr: string) {
    setSelDate(dateStr);
    // slot đã chọn có còn hợp lệ ở ngày mới không sẽ do useEffect phía trên xử lý
  }

  function pickTime(time: string) {
    const next = selTime === time ? "" : time;
    setSelTime(next);
    if (selDate && next) {
      onChange(dateAtMinutes(selDate, hhmmToMinutes(next)).toISOString());
    } else {
      onChange("");
    }
  }

  const monthLabel = t("pickup_scheduler.month_year", {
    month: t(`pickup_scheduler.months.m${viewMonth + 1}`),
    year: viewYear,
  });

  /** Vi: "Thứ Ba, 20/05/2026 lúc 14:30" · En: "Tuesday, 20/05/2026 at 14:30" */
  function formatSelected(dateStr: string, timeStr: string): string {
    const d = dateAtMinutes(dateStr, hhmmToMinutes(timeStr));
    return t("pickup_scheduler.selected", {
      weekday: t(`pickup_scheduler.weekday_long.${WEEKDAY_KEYS[d.getDay()]}`),
      day: pad(d.getDate()),
      month: pad(d.getMonth() + 1),
      year: d.getFullYear(),
      time: timeStr,
    });
  }
  const canGoPrev = !(viewYear === now.getFullYear() && viewMonth === now.getMonth());
  const today = todayDate();

  return (
    <div className="mt-3 space-y-4">
      {/* ── Calendar ─────────────────────────────────── */}
      <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-sm">
        {/* Month nav */}
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={prevMonth}
            disabled={!canGoPrev}
            className="flex size-7 items-center justify-center rounded-lg text-foreground/50 hover:bg-kun-filter-pill-bg disabled:opacity-25"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-semibold text-foreground">{monthLabel}</span>
          <button
            type="button"
            onClick={nextMonth}
            className="flex size-7 items-center justify-center rounded-lg text-foreground/50 hover:bg-kun-filter-pill-bg"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="mb-1 grid grid-cols-7 text-center">
          {WEEKDAY_KEYS.map((k) => (
            <span key={k} className="py-1 text-[10px] font-semibold uppercase text-foreground/40">
              {t(`pickup_scheduler.weekday_short.${k}`)}
            </span>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {calDays.map((cell, i) => {
            if (!cell) return <span key={`e-${i}`} />;
            const isSelected = cell.dateStr === selDate;
            const isToday = cell.dateStr === today;
            return (
              <button
                key={cell.dateStr}
                type="button"
                disabled={cell.disabled}
                onClick={() => pickDate(cell.dateStr)}
                className={`mx-auto flex size-8 items-center justify-center rounded-full text-sm font-medium transition-colors
                  ${cell.disabled ? "cursor-not-allowed text-foreground/20" : ""}
                  ${isSelected ? "bg-kun-products-forest text-white shadow-sm" : ""}
                  ${!isSelected && isToday ? "font-bold text-kun-products-forest ring-1 ring-kun-products-forest/40" : ""}
                  ${!isSelected && !cell.disabled ? "hover:bg-kun-mint/30 text-foreground" : ""}
                `}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Time slots ───────────────────────────────── */}
      {selDate && (
        <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="size-4 text-foreground/40" />
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
              {t("select_time")}
            </span>
          </div>

          {availableSlots.length === 0 ? (
            <p className="text-xs text-foreground/45">
              {storeStatus ? t("no_pickup_slots") : t("loading")}
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
              {availableSlots.map(({ time, disabled }) => {
                const isSelected = selTime === time;
                return (
                  <button
                    key={time}
                    type="button"
                    disabled={disabled}
                    onClick={() => pickTime(time)}
                    className={`rounded-xl px-2 py-2 text-sm font-medium transition-colors
                      ${disabled ? "cursor-not-allowed text-foreground/20" : ""}
                      ${isSelected ? "bg-kun-products-forest text-white shadow-sm" : ""}
                      ${!isSelected && !disabled ? "bg-kun-filter-pill-bg text-foreground hover:bg-kun-mint/30" : ""}
                    `}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Summary ──────────────────────────────────── */}
      {selDate && selTime && (
        <div className="flex items-center gap-2 rounded-xl bg-kun-mint/20 px-4 py-3 text-sm font-medium text-kun-products-forest">
          <Clock className="size-4 shrink-0" />
          {formatSelected(selDate, selTime)}
        </div>
      )}

      {selDate && !selTime && availableSlots.length > 0 && (
        <p className="text-xs text-foreground/45">{t("select_time_above")}</p>
      )}
    </div>
  );
}