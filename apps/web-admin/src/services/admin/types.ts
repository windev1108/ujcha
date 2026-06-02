export type AdminFeedback = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  content: string;
  rating: number | null;
  createdAt: string;
};

export type AdminFeedbackPage = {
  items: AdminFeedback[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminFeedbackStats = {
  total: number;
  todayCount: number;
  avgRating: number | null;
  byRating: Record<number, number>;
};

export type AdminCategory = {
  id: string;
  name: string;
  nameTranslation?: Record<string, string>;
  slug: string;
  thumbnail: string | null;
  sortOrder: number;
  _count?: { products: number };
};

export type ProductOptionValue = {
  label: string;
  priceDelta: number;
  nameTranslation?: Record<string, string>;
  descriptionTranslation?: Record<string, string>;
};

export type ProductOptionGroup = {
  id: string;
  name: string;
  nameTranslation?: Record<string, string>;
  selectionMin: number;
  selectionMax: number;
  values: ProductOptionValue[];
};

export type ProductTopping = {
  id: string;
  name: string;
  nameTranslation?: Record<string, string>;
  price: number;
  isActive: boolean;
};

export type VariantGroup = {
  id: string;
  name: string;
  values: ProductOptionValue[];
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateVariantGroupBody = {
  name: string;
  values?: Array<{ label: string; priceDelta?: number }>;
  sortOrder?: number;
  isActive?: boolean;
};

export type UpdateVariantGroupBody = Partial<CreateVariantGroupBody>;

export type AdminProduct = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  /** JSON decimal string */
  price: string;
  imageUrls: string[];
  /** Inline option groups per product. */
  optionGroups: ProductOptionGroup[];
  /** Inline toppings per product. */
  toppings: ProductTopping[];
  /** Bản dịch tên món: { "en": "...", "ko": "..." } */
  nameTranslation: Record<string, string>;
  /** Bản dịch mô tả món: { "en": "...", "ko": "..." } */
  descriptionTranslation: Record<string, string>;
  isAvailable: boolean;
  isSoldOut: boolean;
  /** Giảm giá theo sản phẩm 0–100 (cộng với giảm giá toàn shop). */
  discountPercent: number;
  createdAt?: string;
  updatedAt?: string;
  category: { id: string; name: string; slug: string };
};

export type ShopSettings = {
  id: string;
  globalDiscountPercent: number;
  updatedAt: string;
};

export type PaymentConfig = {
  id: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  sePayApiKey: string;
  isEnabled: boolean;
  updatedAt: string;
};

export type UpdatePaymentConfigBody = {
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;
  sePayApiKey?: string;
  isEnabled?: boolean;
};

export type CreateProductBody = {
  categoryId: string;
  /** Để trống — server tự sinh từ tên (slugify). */
  sku?: string;
  name: string;
  slug?: string;
  description?: string;
  price: number;
  imageUrls?: string[];
  nameTranslation?: Record<string, string>;
  descriptionTranslation?: Record<string, string>;
  optionGroups?: Array<{ id?: string; name: string; nameTranslation?: Record<string, string>; selectionMin?: number; selectionMax?: number; values: Array<{ label: string; priceDelta?: number; nameTranslation?: Record<string, string>; descriptionTranslation?: Record<string, string> }> }>;
  toppings?: Array<{ id?: string; name: string; price: number; isActive?: boolean; nameTranslation?: Record<string, string>; descriptionTranslation?: Record<string, string> }>;
  isAvailable?: boolean;
  isSoldOut?: boolean;
  discountPercent?: number;
};

export type UpdateProductBody = Partial<CreateProductBody>;

export type CreateCategoryBody = {
  name: string;
  slug?: string;
  sortOrder?: number;
  thumbnail?: string | null;
  nameTranslation?: Record<string, string>;
};

export type UpdateCategoryBody = Partial<CreateCategoryBody>;

/** Đồng bộ Prisma enum */
export type AdminOrderType = "delivery" | "table" | "pickup";
export type AdminOrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "delivering"
  | "completed"
  | "cancelled";
export type AdminPaymentStatus = "pending" | "paid";
export type AdminPaymentType = "cash" | "bank_transfer";

export type AdminOverviewMetricWindow = {
  current: number;
  previous: number;
  changePercent: number | null;
  /** Chỉ có trên trường revenue — doanh thu từ đơn hệ thống (không bao gồm platform) */
  systemRevenue?: number;
  /** Breakdown doanh thu theo platform: { grab: number, shopee: number, … } */
  platformBreakdown?: Record<string, number>;
};

export type PlatformRevenueSummary = {
  id: string;
  platform: string;
  date: string;
  totalEarnings: number;
  revenue: number;
  completedOrders: number;
  cancelledOrders: number;
  syncedAt: string;
};

export type AdminOverviewDashboard = {
  range: {
    last7: { from: string; to: string };
    previous7: { from: string; to: string };
  };
  summary: {
    revenue: AdminOverviewMetricWindow;
    orders: AdminOverviewMetricWindow;
    newUsers: AdminOverviewMetricWindow;
    referrals: AdminOverviewMetricWindow;
    pointsIssued: number;
  };
  revenueByDay: { date: string; revenue: number; systemRevenue?: number; platformRevenue?: number }[];
  orderTypeShare: {
    totalInRange: number;
    delivery: { count: number; percent: number };
    pickup: { count: number; percent: number };
    table: { count: number; percent: number };
  };
  recentOrders: Array<{
    id: string;
    paymentCode: string;
    status: AdminOrderStatus;
    type: AdminOrderType;
    finalAmount: string;
    createdAt: string;
    customerName: string;
    firstItemName: string;
  }>;
  totalOrdersAllTime: number;
  platformRevenueSynced?: PlatformRevenueSummary[];
};

export type AdminOrderUser = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
};

export type OrderItemExtraSnapshot = {
  toppingId: string;
  name: string;
  price: number;
};

export type AdminOrderItem = {
  id: string;
  quantity: number;
  price: string;
  /** Snapshot topping từ server */
  extrasJson?: unknown;
  /** Tuỳ chọn nhóm */
  optionsJson?: unknown;
  note?: string | null;
  product: {
    id: string;
    name: string;
    slug: string;
    imageUrls: unknown;
    price: string;
  };
};

export type AdminTopping = {
  id: string;
  name: string;
  price: string;
  isActive: boolean;
  sortOrder: number;
};

/** Đồng bộ Prisma `VoucherDiscountType` */
export type AdminVoucherDiscountType = "percent" | "fixed_amount";

export type AdminVoucher = {
  id: string;
  code: string;
  name: string;
  discountType: AdminVoucherDiscountType;
  /** Decimal string */
  discountValue: string;
  minOrderAmount: string;
  maxDiscountAmount: string | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  perUserLimit: number;
  isActive: boolean;
  isWelcome: boolean;
  createdAt: string;
  updatedAt: string;
  /** Số lần mã này được gán trong thưởng giới thiệu (ReferralReward). */
  issuedCount: number;
};

export type AdminVoucherStats = {
  totalVouchers: number;
  activeEffectiveCount: number;
  referralIssuedTotal: number;
  referralRatePercent: number | null;
  estimatedMaxDiscountVnd: number;
  nextExpiring: {
    code: string;
    name: string;
    endsAt: string;
    hoursLeft: number;
  } | null;
};

export type CreateVoucherBody = {
  code: string;
  name: string;
  discountType: AdminVoucherDiscountType;
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number | null;
  startsAt?: string;
  endsAt?: string;
  usageLimit?: number;
  perUserLimit?: number;
  isActive?: boolean;
  isWelcome?: boolean;
};

export type UpdateVoucherBody = Partial<CreateVoucherBody>;

export type AdminOrder = {
  id: string;
  /** Null = khách không tài khoản (POS / giao không member). */
  userId: string | null;
  type: AdminOrderType;
  /** Token duy nhất để khách quét QR bill tích điểm (single-use). */
  loyaltyQrToken: string;
  addressId: string | null;
  guestDeliveryAddress?: string | null;
  guestDeliveryPhone?: string | null;
  guestDeliveryName?: string | null;
  tableId: string | null;
  pickupTime: string | null;
  paymentType: 'cash' | 'bank_transfer';
  totalAmount: string;
  discountAmount: string;
  pointDiscountAmount: string;
  shippingFee: string;
  finalAmount: string;
  status: AdminOrderStatus;
  paymentStatus: AdminPaymentStatus;
  paymentCode: string;
  shipperId: string | null;
  createdAt: string;
  updatedAt: string;
  user: AdminOrderUser | null;
  shipper: { id: string; name: string; phone: string | null } | null;
  table: { id: string; name: string; qrCode: string } | null;
  address: { id: string; fullAddress: string; lat: number | null; lng: number | null } | null;
  items: AdminOrderItem[];
  typeDisplay: {
    kind: "delivery" | "table" | "pickup";
    delivery?: {
      shipperId: string | null;
      shipper: unknown;
      address: unknown;
      guestDeliveryAddress?: string | null;
      guestDeliveryPhone?: string | null;
      guestDeliveryName?: string | null;
    };
    table?: { tableId: string | null; table: unknown };
    pickup?: { pickupTime: string | null };
  };
};

export type AdminOrderListResponse = {
  items: AdminOrder[];
  total: number;
  page: number;
  pageSize: number;
};

// ─── Tax / VAT types ───────────────────────────────────────────────

export type VatConfig = {
  id: string;
  label: string;
  /** Decimal string, e.g. "10.00" */
  vatPercent: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { orders: number };
};

export type TaxOverview = {
  totalRevenue: number;
  totalVat: number;
  totalCount: number;
  paidCount: number;
  avgVatRate: number;
  paymentsTotal: number;
  reconciliationDiff: number;
  range: { from: string; to: string };
};

export type TaxTransaction = {
  id: string;
  paymentCode: string;
  createdAt: string;
  type: AdminOrderType;
  status: AdminOrderStatus;
  paymentStatus: AdminPaymentStatus;
  totalAmount: string;
  discountAmount: string;
  finalAmount: string;
  vatRate: string;
  vatAmount: string;
  vatConfigId: string | null;
  user: { id: string; name: string; phone: string | null } | null;
};

export type TaxTransactionListResponse = {
  items: TaxTransaction[];
  total: number;
  page: number;
  pageSize: number;
};

export type TaxReportRow = {
  period: string;
  orderCount: number;
  revenue: number;
  vatAmount: number;
};

export type CreateVatConfigBody = {
  label: string;
  vatPercent: number;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive?: boolean;
};

export type UpdateVatConfigBody = Partial<CreateVatConfigBody>;

export type AdminOrderStats = {
  totalRevenue: number;
  activeOrders: number;
  avgOrderValue: number;
  fulfillmentSuccessPercent: number;
  range: { from: string; to: string };
};

export type AdminShipper = {
  id: string;
  /** ID tài khoản staff liên kết (nếu được tạo từ staff). */
  adminId: string | null;
  name: string;
  phone: string | null;
  isActive: boolean;
  /** Ảnh khuôn mặt từ face profile của staff liên kết. */
  imageUrl: string | null;
  /** Số đơn delivery đã hoàn thành (từ API list). */
  completedDeliveryCount?: number;
};

export type AdminShipperStats = {
  totalRegistered: number;
  totalActive: number;
  /** Shipper đang bật và không có đơn delivery đang xử lý. */
  availableNow: number;
  /** Phút — ước lượng từ đơn completed gần đây; null nếu chưa có dữ liệu. */
  avgDeliveryMinutes: number | null;
};

export type AdminTableRow = {
  id: string;
  name: string;
  /** Khu vực / tầng (hiển thị nhóm trong UI). */
  area: string;
  qrCode: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  /** Có đơn bàn đang mở (pending…ready). */
  inUse?: boolean;
};

export type AdminTableStats = {
  totalTables: number;
  inUseCount: number;
  capacityPercent: number;
  newTablesThisWeek: number;
  /** Tổng số đơn loại đặt tại bàn (OrderType.table). */
  tableOrdersCount: number;
};

export type CreateTableBody = {
  name: string;
  area?: string;
};

export type UpdateTableBody = {
  name?: string;
  area?: string;
  isActive?: boolean;
};

export type AdminTableQrPayload = {
  tableId: string;
  url: string;
  path: string;
};

export type AdminUserSearchRow = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  /** Số dư điểm UjCha (API tìm khách). */
  pointBalance?: number;
};

export type PointConfigSerialized = {
  id: string;
  pointRate: number;
  earnPercent: string;
  maxUsagePercent: string;
  minOrderAmount: string;
  delayHours: number;
  expireDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PointCampaignSerialized = {
  id: string;
  name: string;
  earnPercent: string;
  startAt: string;
  endAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PointConfigCurrentResponse = {
  config: PointConfigSerialized;
  activeCampaign: PointCampaignSerialized | null;
  earnPercentSource: "campaign" | "config";
  effectiveEarnPercent: string;
};

export type PointSystemStats = {
  totalPointsInCirculation: number;
  usersWithPoints: number;
  membersVerified: number;
};

export type PointTransactionRow = {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  };
  type: "earn" | "spend" | "expire";
  amount: number;
  source: string;
  referenceId: string | null;
  expiresAt: string | null;
  usableFrom: string | null;
  remainingAmount: number | null;
  createdAt: string;
};

export type PointTransactionsListResponse = {
  items: PointTransactionRow[];
  total: number;
  skip: number;
  limit: number;
};

export type UpdatePointConfigBody = {
  pointRate?: number;
  earnPercent?: number;
  maxUsagePercent?: number;
  minOrderAmount?: number;
  delayHours?: number;
  expireDays?: number;
  isActive?: boolean;
};

export type CreatePointCampaignBody = {
  name: string;
  earnPercent: number;
  startAt: string;
  endAt: string;
  isActive?: boolean;
};

export type UpdatePointCampaignBody = Partial<CreatePointCampaignBody>;

export type AdjustPointsBody = {
  userId: string;
  amount: number;
  note?: string;
};

export type PointRewardVoucherSnap = {
  id: string;
  code: string;
  name: string;
  discountType: "percent" | "fixed_amount";
  discountValue: string;
  minOrderAmount: string;
  maxDiscountAmount: string | null;
  endsAt: string | null;
  isActive?: boolean;
};

export type PointRewardCatalogItem = {
  id: string;
  name: string;
  description: string | null;
  pointCost: number;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  voucher: PointRewardVoucherSnap;
};

export type CreatePointRewardBody = {
  name: string;
  description?: string | null;
  pointCost: number;
  voucherId: string;
  imageUrl?: string | null;
  isActive?: boolean;
  sortOrder?: number;
};

export type UpdatePointRewardBody = Partial<CreatePointRewardBody>;

export type AdminUserAddress = {
  id: string;
  fullAddress: string;
  note: string | null;
  isDefault: boolean;
};

/** GET /admin/referrals/dashboard */
export type AdminReferralDashboard = {
  stats: {
    totalReferralsAllTime: number;
    referralSignupsMomPercent: number | null;
    successfulPaidOrders: number;
    conversionPercent: number | null;
    totalPointsRewarded: number;
    newReferralSignupsThisWeek: number;
  };
  topReferrers: Array<{
    rank: number;
    userId: string;
    name: string;
    location: string;
    inviteCount: number;
    pointsFromReferral: number;
  }>;
  referralSignupsByDay: Array<{ date: string; count: number }>;
  milestoneClaims?: {
    bronze: number;
    silver: number;
    gold: number;
    diamond: number;
  };
  milestoneConfig?: {
    bronzeThreshold: number;
    bronzePoints: number;
    silverThreshold: number;
    silverPoints: number;
    goldThreshold: number;
    goldPoints: number;
    diamondThreshold: number;
    diamondPoints: number;
  };
};

export type AdminReferralUserRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar: string | null;
  referralCode: string;
  phoneVerifiedAt: string | null;
  pointBalance: number;
  createdAt: string;
  _count: { referrals: number };
};

export type AdminReferralUsersPage = {
  items: AdminReferralUserRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type AdminReferralProgramConfig = {
  id: string;
  isActive: boolean;
  minOrderAmount: string;
  referrerCommissionPercent: number;
  welcomeVoucherId: string | null;
  maxReferrerRewardsPerDay: number;
  blockSameIpAsReferrer: boolean;
  blockSameDeviceAsReferrer: boolean;
  bronzeThreshold: number;
  bronzePoints: number;
  silverThreshold: number;
  silverPoints: number;
  goldThreshold: number;
  goldPoints: number;
  diamondThreshold: number;
  diamondPoints: number;
  updatedAt: string;
};

export type UpdateReferralProgramBody = {
  isActive?: boolean;
  minOrderAmount?: number;
  referrerCommissionPercent?: number;
  welcomeVoucherId?: string | null;
  maxReferrerRewardsPerDay?: number;
  blockSameIpAsReferrer?: boolean;
  blockSameDeviceAsReferrer?: boolean;
  bronzeThreshold?: number;
  bronzePoints?: number;
  silverThreshold?: number;
  silverPoints?: number;
  goldThreshold?: number;
  goldPoints?: number;
  diamondThreshold?: number;
  diamondPoints?: number;
};

export type ReferralRewardStatus = "pending" | "credited" | "void";

export type AdminReferralRewardRow = {
  id: string;
  amount: string;
  status: ReferralRewardStatus;
  referrerPointsGranted: number | null;
  createdAt: string;
  beneficiary: {
    id: string;
    name: string;
    referralCode: string;
    phone: string | null;
  };
  referredUser: { id: string; name: string; phone: string | null };
  order: {
    id: string;
    paymentCode: string;
    finalAmount: string;
    status: AdminOrderStatus;
  } | null;
};

export type AdminReferralRewardsResponse = {
  items: AdminReferralRewardRow[];
  total: number;
};

export type AdminPostType = "news" | "blog" | "promotion";
export type AdminPostStatus = "draft" | "published";
export type AdminPostContentFormat = "markdown" | "html";

export type AdminPostAuthor = {
  id: string;
  phone: string;
  role: string;
};

export type AdminPost = {
  id: string;
  title: string;
  slug: string;
  content: string;
  contentFormat: AdminPostContentFormat;
  thumbnail: string | null;
  type: AdminPostType;
  status: AdminPostStatus;
  authorId: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: AdminPostAuthor;
};

export type AdminPostsListResponse = {
  items: AdminPost[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CreatePostBody = {
  title: string;
  content: string;
  contentFormat: AdminPostContentFormat;
  thumbnail?: string;
  type: AdminPostType;
  status?: AdminPostStatus;
};

export type UpdatePostBody = Partial<CreatePostBody>;

export type AdminRole = 'super_admin' | 'staff';

export type AdminRow = {
  id: string;
  email: string | null;
  role: AdminRole;
  isActive: boolean;
  name: string | null;
  phone: string | null;
  address: string | null;
  createdAt: string;
};

export type AdminListResponse = {
  items: AdminRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type AdminStats = {
  total: number;
  superAdminCount: number;
  staffCount: number;
};

export type CreateAdminBody = {
  email?: string;
  role: AdminRole;
  name?: string;
  phone?: string;
  address?: string;
};

export type UpdateAdminBody = {
  role?: AdminRole;
  name?: string;
  phone?: string;
  address?: string;
};

export type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  avatar: string | null;
  pointBalance: number;
  referralCode: string;
  createdAt: string;
  suspiciousAt: string | null;
};

export type CustomerListResponse = {
  items: CustomerRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

// ─── HRM types ──────────────────────────────────────────────────────

export type ShiftConfig = {
  id: string;
  startMinutes: number;
  endMinutes: number;
  toleranceMinutes: number;
  updatedAt: string;
};

export type StoreLocation = {
  id: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  address: string;
  phone: string | null;
  updatedAt: string;
};

export type StaffFaceProfile = {
  id: string;
  adminId: string;
  imageUrl: string | null;
  updatedAt: string;
};

export type AttendanceType = "checkin" | "checkout";

export type AttendanceRecord = {
  id: string;
  adminId: string;
  type: AttendanceType;
  lat: number | null;
  lng: number | null;
  distanceMeters: number | null;
  faceDistance: number | null;
  createdAt: string;
  admin: { id: string; email: string | null; role: AdminRole; name: string | null };
};

export type AttendanceTodayRecord = {
  records: Omit<AttendanceRecord, "admin">[];
  lastType: AttendanceType | null;
  totalMinutes: number;
};

export type AttendanceListResponse = {
  items: AttendanceRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type DailySummaryPair = {
  checkin: Omit<AttendanceRecord, "admin">;
  checkout: Omit<AttendanceRecord, "admin"> | null;
};

export type DailySummaryItem = {
  adminId: string;
  date: string;
  admin: { id: string; email: string | null; role: AdminRole; name: string | null; faceImageUrl: string | null };
  pairs: DailySummaryPair[];
  totalMinutes: number;
};

export type AttendanceDailySummaryResponse = {
  items: DailySummaryItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type StaffWithFaceProfile = Pick<AdminRow, "id" | "email" | "role" | "isActive" | "name" | "phone" | "address" | "createdAt"> & {
  permissions: string[];
  faceProfile: Pick<StaffFaceProfile, "adminId" | "imageUrl" | "updatedAt"> | null;
};
