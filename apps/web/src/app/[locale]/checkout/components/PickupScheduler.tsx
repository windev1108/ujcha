"use client";

import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useMemo, useState } from "react";

// ── helpers ──────────────────────────────────────────────────────────────────

const VI_DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function todayDate() {
  return isoDate(new Date());
}

/** All 30-min slots 07:00 → 21:30 */
function buildTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 7; h <= 21; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 22) slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}
const TIME_SLOTS = buildTimeSlots();

/** First weekday (0=Sun) of a month */
function firstWeekday(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/** Days in month */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Human-readable: "Thứ Ba, 20/05/2026 lúc 14:30" */
function formatSelected(dateStr: string, timeStr: string): string {
  const d = new Date(`${dateStr}T${timeStr}`);
  const dow = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"][d.getDay()];
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  const yr = d.getFullYear();
  return `${dow}, ${day}/${mon}/${yr} lúc ${timeStr}`;
}

// ── component ─────────────────────────────────────────────────────────────────

type Props = {
  value: string; // ISO string or ""
  onChange: (iso: string) => void;
};

export function PickupScheduler({ value, onChange }: Props) {
  const now = new Date();
  const minMs = now.getTime() + 15 * 60_000; // earliest valid time

  // parse existing value
  const initDate = value ? isoDate(new Date(value)) : "";
  const initTime = value
    ? new Date(value).toTimeString().slice(0, 5)
    : "";

  const [viewYear, setViewYear] = useState(() => now.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => now.getMonth()); // 0-based
  const [selDate, setSelDate] = useState(initDate);
  const [selTime, setSelTime] = useState(initTime);

  // ── calendar grid ──────────────────────────────────────────────────────────
  const calDays = useMemo(() => {
    const pad = firstWeekday(viewYear, viewMonth);
    const total = daysInMonth(viewYear, viewMonth);
    const cells: Array<{ day: number; dateStr: string; disabled: boolean } | null> = [];
    for (let i = 0; i < pad; i++) cells.push(null);
    for (let d = 1; d <= total; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const date = new Date(dateStr);
      // disable if before today
      const disabled = isoDate(date) < todayDate();
      cells.push({ day: d, dateStr, disabled });
    }
    return cells;
  }, [viewYear, viewMonth]);

  // ── time slots for selected date ───────────────────────────────────────────
  const availableSlots = useMemo(() => {
    return TIME_SLOTS.map((t) => {
      let disabled = false;
      if (selDate === todayDate()) {
        const [hh, mm] = t.split(":").map(Number);
        const slotMs = new Date(selDate).setHours(hh, mm, 0, 0);
        disabled = slotMs < minMs;
      }
      return { time: t, disabled };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selDate]);

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
    // if previously selected time is now invalid on the new date, clear it
    if (dateStr === todayDate() && selTime) {
      const [hh, mm] = selTime.split(":").map(Number);
      const slotMs = new Date(dateStr).setHours(hh, mm, 0, 0);
      if (slotMs < minMs) setSelTime("");
    }
  }

  function pickTime(time: string) {
    const next = selTime === time ? "" : time;
    setSelTime(next);
    if (selDate && next) {
      const [hh, mm] = next.split(":").map(Number);
      const d = new Date(selDate);
      d.setHours(hh, mm, 0, 0);
      onChange(d.toISOString());
    } else {
      onChange("");
    }
  }

  const monthLabel = `Tháng ${viewMonth + 1}, ${viewYear}`;
  const canGoPrev = !(viewYear === now.getFullYear() && viewMonth === now.getMonth());

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
          {VI_DAYS.map((d) => (
            <span key={d} className="py-1 text-[10px] font-semibold uppercase text-foreground/40">
              {d}
            </span>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {calDays.map((cell, i) => {
            if (!cell) return <span key={`e-${i}`} />;
            const isSelected = cell.dateStr === selDate;
            const isToday = cell.dateStr === todayDate();
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
              Chọn giờ
            </span>
          </div>
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
        </div>
      )}

      {/* ── Summary ──────────────────────────────────── */}
      {selDate && selTime && (
        <div className="flex items-center gap-2 rounded-xl bg-kun-mint/20 px-4 py-3 text-sm font-medium text-kun-products-forest">
          <Clock className="size-4 shrink-0" />
          {formatSelected(selDate, selTime)}
        </div>
      )}

      {selDate && !selTime && (
        <p className="text-xs text-foreground/45">Chọn giờ nhận hàng bên trên.</p>
      )}
    </div>
  );
}
