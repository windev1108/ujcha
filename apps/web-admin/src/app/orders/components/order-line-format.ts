import type { AdminOrderItem, OrderItemExtraSnapshot } from "@/services/admin/types";

export function parseOrderItemExtras(raw: unknown): OrderItemExtraSnapshot[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is OrderItemExtraSnapshot =>
      x != null &&
      typeof x === "object" &&
      typeof (x as OrderItemExtraSnapshot).name === "string",
  );
}

export function parseOrderItemOptions(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export function formatOrderLineSubtitle(it: AdminOrderItem): string | null {
  const parts: string[] = [];
  const opts = parseOrderItemOptions(it.optionsJson);
  const optStr = Object.entries(opts)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
  if (optStr) parts.push(optStr);
  const extras = parseOrderItemExtras(it.extrasJson);
  if (extras.length) {
    parts.push(extras.map((e) => `+${e.name}`).join(", "));
  }
  if (it.note?.trim()) parts.push(`Ghi chú: ${it.note.trim()}`);
  return parts.length ? parts.join(" · ") : null;
}
