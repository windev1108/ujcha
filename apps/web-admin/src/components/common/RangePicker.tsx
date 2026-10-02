"use client";

export type Preset = "7" | "30" | "90" | "month" | "custom";
export type DateRange = { from: string; to: string };

const VN_OFFSET_MS = 7 * 3600_000;
export const vnToday = () =>
  new Date(Date.now() + VN_OFFSET_MS).toISOString().slice(0, 10);

const addDays = (s: string, n: number) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function rangeForPreset(p: Exclude<Preset, "custom">): DateRange {
  const to = vnToday();
  if (p === "month") return { from: `${to.slice(0, 8)}01`, to };
  return { from: addDays(to, -(Number(p) - 1)), to };
}

export function isValidRange(r: DateRange): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.from) || !/^\d{4}-\d{2}-\d{2}$/.test(r.to)) return false;
  if (r.from > r.to) return false;
  const days =
    (Date.parse(`${r.to}T00:00:00Z`) - Date.parse(`${r.from}T00:00:00Z`)) / 86_400_000;
  return days <= 365;
}

const PRESETS: Array<[Exclude<Preset, "custom">, string]> = [
  ["7", "7 ngày"],
  ["30", "30 ngày"],
  ["90", "90 ngày"],
  ["month", "Tháng này"],
];

const dateInputClass =
  "h-8 rounded-full border border-black/10 bg-white px-3 text-xs font-medium text-foreground/70 shadow-sm outline-none transition focus:border-[#1a3c34]/40";

export function RangePicker({
  preset,
  range,
  valid,
  onPreset,
  onCustom,
}: {
  preset: Preset;
  range: DateRange;
  valid: boolean;
  onPreset: (p: Exclude<Preset, "custom">) => void;
  onCustom: (r: DateRange) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-black/10 bg-white p-1 shadow-sm">
        {PRESETS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => onPreset(k)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              preset === k
                ? "bg-[#1a3c34] text-white shadow-sm"
                : "text-foreground/50 hover:text-foreground/80"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-foreground/45">
        <input
          type="date"
          value={range.from}
          max={range.to}
          onChange={(e) => onCustom({ ...range, from: e.target.value })}
          className={dateInputClass}
          aria-label="Từ ngày"
        />
        <span>→</span>
        <input
          type="date"
          value={range.to}
          min={range.from}
          max={vnToday()}
          onChange={(e) => onCustom({ ...range, to: e.target.value })}
          className={dateInputClass}
          aria-label="Đến ngày"
        />
      </div>
      {!valid && (
        <span className="text-xs font-medium text-red-600">
          Khoảng ngày không hợp lệ (tối đa 366 ngày).
        </span>
      )}
    </div>
  );
}