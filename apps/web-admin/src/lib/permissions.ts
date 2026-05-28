export const PERMISSIONS = {
  DASHBOARD: "dashboard",
  HRM: "hrm",
  USERS: "users",
  ATTENDANCE: "attendance",
  ORDERS: "orders",
  CATEGORIES: "categories",
  PAYMENT: "payment",
  PRINTER: "printer",
  PRODUCTS: "products",
  TABLES: "tables",
  SHIPPERS: "shippers",
  VOUCHERS: "vouchers",
  POINTS: "points",
  REFERRALS: "referrals",
  POSTS: "posts",
  TAXES: "taxes",
  VOICER: "voicer",
  FEEDBACK: "feedback",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** All permissions shown in the modal, in display order. */
export const ALL_PERMISSIONS: Permission[] = [
  "attendance",
  "dashboard",
  "orders",
  "tables",
  "shippers",
  "products",
  "categories",
  "vouchers",
  "points",
  "taxes",
  "payment",
  "printer",
  "users",
  "referrals",
  "posts",
  "hrm",
  "voicer",
  "feedback",
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  attendance: "Chấm công",
  dashboard: "Tổng quan",
  orders: "Đơn hàng",
  tables: "Bàn",
  shippers: "Shippers",
  products: "Sản phẩm",
  categories: "Danh mục",
  vouchers: "Vouchers",
  points: "Điểm UjCha",
  taxes: "Quản lý thuế",
  payment: "Thanh toán",
  printer: "Máy in",
  users: "Khách hàng",
  referrals: "Giới thiệu",
  posts: "Bài viết",
  hrm: "Nhân sự (HRM)",
  voicer: "Giọng đọc TTS",
  feedback: "Phản hồi KH",
};

/**
 * Maps route prefixes to required permission (staff only).
 * Dashboard "/" and attendance "/attendance" are handled separately.
 */
export const ROUTE_PERMISSION_MAP: Record<string, Permission> = {
  "/hrm": "hrm",
  "/users": "users",
  "/orders": "orders",
  "/categories": "categories",
  "/payment-config": "payment",
  "/printer": "printer",
  "/products": "products",
  "/toppings": "products",
  "/tables": "tables",
  "/shippers": "shippers",
  "/vouchers": "vouchers",
  "/points": "points",
  "/taxes": "taxes",
  "/referrals": "referrals",
  "/posts": "posts",
  "/payments": "payment",
  "/voicer": "voicer",
  "/feedback": "feedback",
};
