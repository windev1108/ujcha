export type ShiftConfig = {
  startMinutes: number;
  endMinutes: number;
  toleranceMinutes: number;
};

export type ShiftStatus = {
  kind: "on_time" | "late" | "early_arrive" | "early_leave" | "overtime";
  diffMinutes: number;
  label: string;
};

/** Convert ISO timestamp to minutes from VN midnight (UTC+7). */
function toVNMinutes(iso: string): number {
  const ms = new Date(iso).getTime() + 7 * 3600_000;
  const d = new Date(ms);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function timeStrToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function getCheckinStatus(checkinIso: string, cfg: ShiftConfig): ShiftStatus {
  const actual = toVNMinutes(checkinIso);
  const { startMinutes, toleranceMinutes } = cfg;
  const diff = actual - startMinutes; // positive = late

  if (diff > toleranceMinutes) {
    return { kind: "late", diffMinutes: diff, label: `Trễ ${diff} phút` };
  }
  if (diff < 0) {
    return { kind: "early_arrive", diffMinutes: -diff, label: `Sớm ${-diff} phút` };
  }
  return { kind: "on_time", diffMinutes: diff, label: "Đúng giờ" };
}

export function getCheckoutStatus(checkoutIso: string, cfg: ShiftConfig): ShiftStatus {
  const actual = toVNMinutes(checkoutIso);
  const { endMinutes, toleranceMinutes } = cfg;
  const diff = actual - endMinutes; // positive = overtime, negative = early leave

  if (diff >= -toleranceMinutes) {
    if (diff > 0) {
      return { kind: "overtime", diffMinutes: diff, label: `OT +${diff} phút` };
    }
    return { kind: "on_time", diffMinutes: 0, label: "Đúng giờ" };
  }
  return { kind: "early_leave", diffMinutes: -diff, label: `Sớm ${-diff} phút` };
}
