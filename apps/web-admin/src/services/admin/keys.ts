export const adminKeys = {
  overview: ["admin", "overview"] as const,
  products: (filters?: { categoryId?: string; q?: string }) =>
    ["admin", "products", filters?.categoryId ?? "", filters?.q ?? ""] as const,
  product: (id: string) => ["admin", "products", id] as const,
  categories: ["admin", "categories"] as const,
  shopSettings: ["admin", "shop-settings"] as const,
  orders: (filters?: {
    type?: string;
    status?: string;
    q?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }) =>
    [
      "admin",
      "orders",
      filters?.type ?? "",
      filters?.status ?? "",
      filters?.q ?? "",
      filters?.from ?? "",
      filters?.to ?? "",
      String(filters?.page ?? 1),
      String(filters?.pageSize ?? 20),
    ] as const,
  order: (id: string) => ["admin", "orders", id] as const,
  orderStats: (from?: string, to?: string) =>
    ["admin", "orders", "stats", from ?? "", to ?? ""] as const,
  tables: ["admin", "tables"] as const,
  table: (id: string) => ["admin", "tables", id] as const,
  tableStats: ["admin", "tables", "stats"] as const,
  shippers: ["admin", "shippers"] as const,
  shipperStats: ["admin", "shippers", "stats"] as const,
  unassignedDeliveryOrders: ["admin", "orders", "unassigned-delivery"] as const,
  toppings: ["admin", "toppings"] as const,
  vouchers: ["admin", "vouchers"] as const,
  voucherStats: ["admin", "vouchers", "stats"] as const,
  pointConfig: ["admin", "point-config"] as const,
  pointStats: ["admin", "point-config", "stats"] as const,
  pointCampaigns: ["admin", "point-campaigns"] as const,
  pointRewards: ["admin", "point-rewards"] as const,
  pointTransactions: (filters?: { skip?: number; type?: string }) =>
    [
      "admin",
      "point-transactions",
      String(filters?.skip ?? 0),
      filters?.type ?? "",
    ] as const,
  referralDashboard: ["admin", "referrals", "dashboard"] as const,
  referralUsers: (filters?: { q?: string; page?: number; pageSize?: number }) =>
    [
      "admin",
      "referrals",
      "users",
      filters?.q ?? "",
      String(filters?.page ?? 1),
      String(filters?.pageSize ?? 10),
    ] as const,
  referralProgramConfig: ["admin", "referrals", "program-config"] as const,
  referralRewards: (filters?: { skip?: number; limit?: number }) =>
    [
      "admin",
      "referrals",
      "rewards",
      String(filters?.skip ?? 0),
      String(filters?.limit ?? 50),
    ] as const,
  posts: (filters?: {
    q?: string;
    status?: string;
    type?: string;
    sort?: string;
    page?: number;
    pageSize?: number;
  }) =>
    [
      "admin",
      "posts",
      filters?.q ?? "",
      filters?.status ?? "",
      filters?.type ?? "",
      filters?.sort ?? "",
      String(filters?.page ?? 1),
      String(filters?.pageSize ?? 10),
    ] as const,
  post: (id: string) => ["admin", "posts", id] as const,
  admins: (filters?: { q?: string; role?: string; page?: number; pageSize?: number }) =>
    [
      "admin",
      "admins",
      filters?.q ?? "",
      filters?.role ?? "",
      String(filters?.page ?? 1),
      String(filters?.pageSize ?? 10),
    ] as const,
  adminItem: (id: string) => ["admin", "admins", id] as const,
  adminStats: ["admin", "admins", "stats"] as const,
  customers: (filters?: { q?: string; page?: number; pageSize?: number }) =>
    [
      "admin",
      "customers",
      filters?.q ?? "",
      String(filters?.page ?? 1),
      String(filters?.pageSize ?? 10),
    ] as const,
  variantGroups: ["admin", "variant-groups"] as const,
  paymentConfig: ["admin", "payment-config"] as const,
  taxOverview: (from?: string, to?: string) =>
    ["admin", "tax", "overview", from ?? "", to ?? ""] as const,
  taxTransactions: (filters?: {
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
    status?: string;
    type?: string;
    q?: string;
  }) =>
    [
      "admin",
      "tax",
      "transactions",
      filters?.from ?? "",
      filters?.to ?? "",
      String(filters?.page ?? 1),
      String(filters?.pageSize ?? 20),
      filters?.status ?? "",
      filters?.type ?? "",
      filters?.q ?? "",
    ] as const,
  taxReports: (from?: string, to?: string, groupBy?: string) =>
    ["admin", "tax", "reports", from ?? "", to ?? "", groupBy ?? "day"] as const,
  vatConfigs: ["admin", "tax", "vat-configs"] as const,
  posRelease: ["admin", "pos-release"] as const,
  feedbacks: (filters?: { page?: number; pageSize?: number; rating?: number }) =>
    [
      "admin",
      "feedbacks",
      String(filters?.page ?? 1),
      String(filters?.pageSize ?? 20),
      String(filters?.rating ?? "all"),
    ] as const,
  feedbackStats: ["admin", "feedback-stats"] as const,
  smsLogs: (filters?: { page?: number; limit?: number; phone?: string }) =>
    [
      "admin",
      "sms-logs",
      String(filters?.page ?? 1),
      String(filters?.limit ?? 20),
      filters?.phone ?? "",
    ] as const,
  shippingConfig: ["admin", "shipping-config"] as const,
  groupOrderConfig: ["admin", "group-order-config"] as const,
};
