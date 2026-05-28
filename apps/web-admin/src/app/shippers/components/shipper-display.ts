export function shipperShortId(id: string): string {
  return `SP-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

export function shipperNameInitials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2) {
    return (p[0]!.slice(0, 1) + p[p.length - 1]!.slice(0, 1)).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "SP";
}

export function formatRelativeVi(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "Vừa xong";
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  return `${Math.floor(h / 24)} ngày trước`;
}

export function deliveryAddressSummary(order: {
  address: unknown;
}): string {
  const a = order.address as { fullAddress?: string | null } | null;
  const line = a?.fullAddress?.trim();
  if (line) return line.length > 48 ? `${line.slice(0, 48)}…` : line;
  return "—";
}
