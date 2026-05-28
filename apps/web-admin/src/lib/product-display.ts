import type { AdminProduct } from "@/services/admin/types";

export type ProductDisplayStatus = "active" | "sold_out" | "disabled";

export function getProductDisplayStatus(p: AdminProduct): ProductDisplayStatus {
  if (!p.isAvailable) return "disabled";
  if (p.isSoldOut) return "sold_out";
  return "active";
}

export function primaryProductImage(p: AdminProduct): string | null {
  const u = p.imageUrls?.[0];
  return typeof u === "string" && u.trim() ? u.trim() : null;
}

export function formatVnd(amount: string | number): string {
  const n = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(n))}₫`;
}

/** Giảm giá hiển thị: % theo SP + % toàn shop, tối đa 100. */
export function effectiveDiscountPercent(
  p: AdminProduct,
  globalDiscountPercent: number,
): number {
  const g = Math.min(100, Math.max(0, Math.round(globalDiscountPercent)));
  const d = Math.min(100, Math.max(0, Math.round(p.discountPercent ?? 0)));
  return Math.min(100, d + g);
}

const badgePalette: Record<string, string> = {
  matcha: "bg-emerald-50 text-emerald-900 ring-emerald-600/15",
  coffee: "bg-amber-50 text-amber-950 ring-amber-600/15",
  "milk-tea": "bg-violet-50 text-violet-900 ring-violet-600/15",
  tea: "bg-lime-50 text-lime-900 ring-lime-700/15",
  accessories: "bg-zinc-100 text-zinc-800 ring-black/10",
  default: "bg-slate-100 text-slate-800 ring-black/8",
};

export function categoryBadgeClass(slug: string): string {
  const key = slug.toLowerCase().replace(/\s+/g, "-");
  for (const k of Object.keys(badgePalette)) {
    if (key.includes(k)) return badgePalette[k] ?? badgePalette.default;
  }
  return badgePalette.default;
}
