import type { AdminPost, AdminPostStatus, AdminPostType } from "@/services/admin/types";

export function postExcerpt(content: string, max = 96): string {
  const t = content
    .replace(/<[^>]*>/g, " ")
    .replace(/[#*_`>\[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function postTypeLabelVi(t: AdminPostType): string {
  switch (t) {
    case "news":
      return "Tin tức";
    case "blog":
      return "Blog";
    case "promotion":
      return "Khuyến mãi";
    default:
      return t;
  }
}

export function postStatusLabelVi(s: AdminPostStatus): string {
  return s === "published" ? "Đã xuất bản" : "Bản nháp";
}

export function postStatusDotClass(s: AdminPostStatus): string {
  return s === "published" ? "bg-emerald-500" : "bg-zinc-400";
}

export function postDisplayDate(p: AdminPost): string {
  const raw = p.status === "published" && p.publishedAt ? p.publishedAt : p.createdAt;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function authorInitials(email: string): string {
  const local = email.split("@")[0] ?? "A";
  return local.slice(0, 2).toUpperCase();
}
