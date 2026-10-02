export const vnToday = () =>
  new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

export const addDays = (s: string, n: number) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const diffDays = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export const fmtDay = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

export function shortVnd(v: number) {
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (a >= 1_000_000) return `${sign}${(a / 1_000_000).toFixed(1)}tr`;
  if (a >= 1000) return `${sign}${Math.round(a / 1000)}k`;
  return String(v);
}

/** % thay đổi tương đối; null nếu kỳ trước = 0 mà kỳ này > 0 (không so sánh được). */
export function deltaPercent(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10;
}

export const UNCOSTED_REASON_LABEL: Record<string, string> = {
  no_recipe: "chưa có công thức",
  missing_cost: "thiếu giá vốn nguyên liệu",
  missing_options: "đơn không có tuỳ chọn (vd đơn ngoài)",
  topping_no_recipe: "topping chưa có định lượng",
};

export const CHANNEL_LABEL: Record<string, string> = {
  DIRECT: "Trực tiếp (web/POS)",
  GRAB: "GrabFood",
  SHOPEE: "ShopeeFood",
};
export const ORDER_TYPE_LABEL: Record<string, string> = {
  delivery: "Giao hàng",
  table: "Tại bàn",
  pickup: "Mang đi",
};
export const PAYMENT_LABEL: Record<string, string> = {
  cash: "Tiền mặt",
  bank_transfer: "Chuyển khoản",
};