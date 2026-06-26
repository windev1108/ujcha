"use client";

const SOURCE_OPTIONS = [
  { id: "", label: "Tất cả" },
  { id: "delivery", label: "Giao hàng" },
  { id: "table", label: "Tại bàn" },
  { id: "pickup", label: "Mang về" },
] as const;

function vnDateStr(d: Date): string {
  const vn = new Date(d.getTime() + 7 * 3600_000);
  return `${vn.getUTCFullYear()}-${String(vn.getUTCMonth() + 1).padStart(2, "0")}-${String(vn.getUTCDate()).padStart(2, "0")}`;
}

function presetRange(id: string): [string, string] {
  const now = new Date();
  const vn = new Date(now.getTime() + 7 * 3600_000);
  const today = vnDateStr(now);

  if (id === "today") return [today, today];

  if (id === "week") {
    const dow = vn.getUTCDay();
    const mon = new Date(vn);
    mon.setUTCDate(vn.getUTCDate() - (dow === 0 ? 6 : dow - 1));
    return [vnDateStr(new Date(mon.getTime() - 7 * 3600_000)), today];
  }

  if (id === "month") {
    const y = vn.getUTCFullYear();
    const m = vn.getUTCMonth() + 1;
    return [`${y}-${String(m).padStart(2, "0")}-01`, today];
  }

  if (id === "year") {
    return [`${vn.getUTCFullYear()}-01-01`, today];
  }

  return [today, today];
}

function detectPreset(from: string, to: string): string | null {
  for (const id of ["today", "week", "month", "year"]) {
    const [f, t] = presetRange(id);
    if (from === f && to === t) return id;
  }
  return null;
}

const PRESETS = [
  { id: "today", label: "Hôm nay" },
  { id: "week", label: "Tuần này" },
  { id: "month", label: "Tháng này" },
  { id: "year", label: "Năm nay" },
];

interface DatePresetPillsProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  className?: string;
}

export function DatePresetPills({ from, to, onChange, className }: DatePresetPillsProps) {
  const active = detectPreset(from, to);
  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? ""}`}>
      {PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => {
            const [f, t] = presetRange(p.id);
            onChange(f, t);
          }}
          className={
            active === p.id
              ? "rounded-full bg-[#1a3c34] px-3 py-1 text-xs font-semibold text-white"
              : "rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-foreground/60 hover:bg-black/8 hover:text-foreground/80"
          }
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

interface SourceFilterPillsProps {
  value: string;
  onChange: (type: string) => void;
  className?: string;
}

export function SourceFilterPills({ value, onChange, className }: SourceFilterPillsProps) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? ""}`}>
      {SOURCE_OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={
            value === o.id
              ? "rounded-full bg-[#1a3c34] px-3 py-1 text-xs font-semibold text-white"
              : "rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-foreground/60 hover:bg-black/8 hover:text-foreground/80"
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
