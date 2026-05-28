import type { AdminOrderStatus } from "@/services/admin/types";

export function formatPctChange(p: number | null | undefined): string {
  if (p == null || Number.isNaN(p)) return "—";
  const sign = p >= 0 ? "+" : "";
  return `${sign}${p}%`;
}

export function formatCompactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

const STATUS_VI: Record<AdminOrderStatus, string> = {
  pending: "Chờ xử lý",
  preparing: "Đang chuẩn bị",
  ready: "Sẵn sàng",
  completed: "Hoàn thành",
  cancelled: "Đã huỷ",
  confirmed: "Đã xác nhận",
  delivering: "Đang giao hàng"
};

export function orderStatusLabelVi(s: AdminOrderStatus): string {
  return STATUS_VI[s] ?? s;
}
