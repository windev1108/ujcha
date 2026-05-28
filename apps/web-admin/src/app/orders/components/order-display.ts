import type { AdminOrder, AdminOrderStatus, AdminOrderType } from "@/services/admin/types";

export function formatOrderRef(order: AdminOrder): string {
  const code = order.paymentCode?.trim();
  if (code) return `#${code}`;
  return `#${order.id.slice(0, 8).toUpperCase()}`;
}

function initialsFromName(name: string): string {
  const n = name.trim();
  if (!n) return "";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (
      parts[0]!.slice(0, 1) + parts[parts.length - 1]!.slice(0, 1)
    ).toUpperCase();
  }
  return n.slice(0, 2).toUpperCase();
}

export function customerInitials(order: AdminOrder): string {
  const u = order.user;
  if (u) {
    const name = u.name?.trim();
    if (name) return initialsFromName(name);
    const e = u.email?.trim();
    if (e) return e.slice(0, 2).toUpperCase();
    const p = u.phone?.trim();
    if (p) return p.slice(-2);
  }
  const gName = order.guestDeliveryName?.trim();
  if (gName) return initialsFromName(gName);
  const gPhone = order.guestDeliveryPhone?.trim();
  if (gPhone) return gPhone.slice(-2);
  return "KH";
}

export function customerDisplayName(order: AdminOrder): string {
  const u = order.user;
  if (u) {
    return (
      u.name?.trim() ||
      u.phone?.trim() ||
      u.email?.trim() ||
      "Khách"
    );
  }
  return (
    order.guestDeliveryName?.trim() ||
    order.guestDeliveryPhone?.trim() ||
    "Khách lẻ"
  );
}

const STATUS_LABEL: Record<AdminOrderStatus, string> = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  preparing: "Đang làm món",
  ready: "Sẵn sàng",
  delivering: "Đang giao",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

export function orderStatusLabel(s: AdminOrderStatus): string {
  return STATUS_LABEL[s] ?? s;
}

/** Chip: soft background + text (HeroUI Chip + className) */
export function orderStatusChipClass(s: AdminOrderStatus): string {
  switch (s) {
    case "pending":
      return "bg-amber-100 text-amber-950 border-0";
    case "confirmed":
      return "bg-sky-100 text-sky-950 border-0";
    case "preparing":
      return "bg-violet-100 text-violet-900 border-0";
    case "ready":
      return "bg-emerald-100 text-emerald-900 border-0";
    case "delivering":
      return "bg-blue-100 text-blue-900 border-0";
    case "completed":
      return "bg-zinc-100 text-zinc-600 border-0";
    case "cancelled":
      return "bg-red-100 text-red-900 border-0";
    default:
      return "bg-zinc-100 text-zinc-800 border-0";
  }
}

export function serviceTypeLabel(t: AdminOrderType): string {
  switch (t) {
    case "delivery":
      return "Giao hàng";
    case "table":
      return "Tại bàn";
    case "pickup":
      return "Mang đi";
    default:
      return t;
  }
}

export function tableLabel(order: AdminOrder): string | null {
  if (order.type !== "table") return null;
  return order.table?.name ?? null;
}

export function formatTimeHm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Hiển thị thông minh: ngày hiện tại → chỉ HH:mm, ngày khác → dd/MM HH:mm */
export function formatOrderTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) {
    return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(d);
  }
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Ngày giờ đầy đủ dùng cho tooltip */
export function formatOrderTimeFull(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

export function canAssignShipper(order: AdminOrder): boolean {
  if (order.type !== "delivery") return false;
  return (
    order.status === "pending" ||
    order.status === "confirmed" ||
    order.status === "preparing" ||
    order.status === "ready" ||
    order.status === "delivering"
  );
}
