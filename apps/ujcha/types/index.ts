// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  name: string
  email: string | null
  phone: string | null
  avatar: string | null
  referralCode: string | null
  googleId: string | null
  emailMarketingEnabled: boolean
  pointBalance?: number
}

export interface AuthTokensResponse {
  user: AuthUser
  accessToken: string
  refreshToken: string
}

// ─── Category ─────────────────────────────────────────────────────────────────

export interface ApiCategory {
  id: string
  name: string
  nameTranslation: Record<string, string> | null
  slug: string
  sortOrder: number
  thumbnail: string | null
  _count?: { products: number }
}

// ─── Product ──────────────────────────────────────────────────────────────────

export interface ProductOptionValue {
  label: string
  priceDelta: number
  nameTranslation: Record<string, string> | null
}

export interface ProductOptionGroup {
  id: string
  name: string
  nameTranslation: Record<string, string> | null
  selectionMin: number
  selectionMax: number
  values: ProductOptionValue[]
}

export interface ProductTopping {
  id: string
  name: string
  nameTranslation: Record<string, string> | null
  price: number
  isActive: boolean
}

export interface ApiProduct {
  id: string
  name: string
  nameTranslation: Record<string, string> | null
  descriptionTranslation: Record<string, string> | null
  slug: string
  sku: string | null
  description: string | null
  price: number
  imageUrls: string[]
  optionGroups: ProductOptionGroup[]
  toppings: ProductTopping[]
  isAvailable: boolean
  isSoldOut: boolean
  discountPercent: number
  finalPrice: number
  category: { id: string; name: string; nameTranslation: Record<string, string> | null; slug: string; thumbnail: string | null }
}

// ─── Cart ─────────────────────────────────────────────────────────────────────

export interface ApiCartTopping {
  toppingId: string
  topping: { id: string; name: string; price: number; nameTranslation: Record<string, string> | null }
}

export interface ApiCartProduct {
  id: string
  name: string
  nameTranslation: Record<string, string> | null
  slug: string
  price: number
  imageUrls: string[]
  discountPercent: number
  finalPrice: number
  optionGroups: ProductOptionGroup[]
  toppings: ProductTopping[]
  category: { id: string; name: string; slug: string }
}

export interface ApiCartItem {
  id: string
  cartId: string
  productId: string
  quantity: number
  selectedOptions: Record<string, string>
  toppings: ApiCartTopping[]
  product: ApiCartProduct
}

export interface ApiCart {
  id: string
  userId: string
  items: ApiCartItem[]
}

// ─── Order ────────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'delivering'
  | 'picked_up'
  | 'arrived'
  | 'completed'
  | 'cancelled'

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'
export type PaymentType = 'cash' | 'bank_transfer'
export type OrderType = 'delivery' | 'pickup' | 'table'

export interface OrderItem {
  id: string
  productId: string
  productName: string
  productSlug: string
  productImage: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  selectedOptions: Record<string, string>
  toppings: { id: string; name: string; price: number }[]
  note: string | null
}

export interface OrderAddress {
  id: string
  fullAddress: string
  lat?: number
  lng?: number
  name?: string
  phone?: string
  note?: string
}

export interface UserOrder {
  id: string
  type: OrderType
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentType: PaymentType
  totalAmount: number
  discountAmount: number
  pointDiscountAmount: number
  shippingFee: number
  finalAmount: number
  paymentCode: string
  pickupTime: string | null
  createdAt: string
  items: OrderItem[]
  address: OrderAddress | null
  earnedPoints: number
  isGroupOrder: boolean
  groupOrderToken: string | null
}

export interface ShipperInfo {
  id: string
  name: string
  phone: string
  avatar: string | null
}

export interface OrderDetail extends UserOrder {
  table: { id: string; name: string } | null
  loyaltyQrToken: string | null
  guestDeliveryName: string | null
  guestDeliveryPhone: string | null
  user: { id: string; name: string; phone: string | null } | null
  shipper: ShipperInfo | null
  confirmedAt: string | null
  preparingAt: string | null
  readyAt: string | null
  deliveringAt: string | null
  pickedUpAt: string | null
  arrivedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  paymentConfig?: PaymentConfig | null
}

export interface CreateOrderItem {
  productId: string
  quantity: number
  selectedOptions: Record<string, string>
  toppingIds: string[]
  note?: string
}

export interface CreateOrderPayload {
  type: OrderType
  paymentType: PaymentType
  addressId?: string
  inlineAddress?: { fullAddress: string; lat?: number; lng?: number; name: string; phone: string; note?: string }
  pickupTime?: string
  tableId?: string
  items: CreateOrderItem[]
  voucherCode?: string
  discountAmount?: number
  shippingFee?: number
  guestDeliveryName?: string
  guestDeliveryPhone?: string
}

// ─── Address ─────────────────────────────────────────────────────────────────

export interface UserAddress {
  id: string
  fullAddress: string
  label: string | null
  lat: number | null
  lng: number | null
  name: string
  phone: string
  note: string | null
  isDefault: boolean
}

// ─── Notification ─────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string
  userId: string
  type: string
  title: string
  content: string
  data: Record<string, unknown> | null
  isRead: boolean
  createdAt: string
  updatedAt: string
}

// ─── Voucher ──────────────────────────────────────────────────────────────────

export interface UserVoucher {
  id: string
  code: string
  name: string
  discountType: 'percent' | 'fixed'
  discountValue: number
  minOrderAmount: number
  maxDiscountAmount: number | null
  expiresAt: string | null
  usedAt: string | null
}

// ─── Rewards ──────────────────────────────────────────────────────────────────

export interface PointRewardCatalog {
  id: string
  name: string
  description: string | null
  pointCost: number
  voucherValue: number
  voucherType: 'percent' | 'fixed'
  isActive: boolean
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export interface UserProfileData {
  id: string
  name: string
  email: string | null
  phone: string | null
  avatar: string | null
  referralCode: string | null
  pointBalance: number
  emailMarketingEnabled: boolean
  lastAvatarUploadAt: string | null
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export interface PaymentConfig {
  bankCode: string
  accountNumber: string
  accountName: string
  bankName: string
}

// ─── Referral ─────────────────────────────────────────────────────────────────

export interface ReferralStats {
  totalInvited: number
  totalEarned: number
  claimedMilestones: string[]
  pendingMilestones: string[]
}

export interface ReferralMilestone {
  id: string
  requiredInvites: number
  rewardPoints: number
  label: string
}
