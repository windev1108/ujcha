// ─── Catalog ──────────────────────────────────────────────────────────────────

import { BillConfig, LabelConfig } from "src/preload"

export interface Category {
  id: string
  name: string
  slug: string
  sortOrder: number
}

export interface ProductOptionValue {
  label: string
  priceDelta: number
  nameTranslation?: Record<string, string>
}

export interface ProductOptionGroup {
  id: string
  name: string
  nameTranslation?: Record<string, string>
  selectionMin?: number
  selectionMax?: number
  values: ProductOptionValue[]
}

export type ProductTopping = {
  id: string
  name: string
  nameTranslation?: Record<string, string>
  price: number
  isActive?: boolean
}

export interface Product {
  id: string
  categoryId: string
  name: string
  price: string          // decimal string
  imageUrls: string[]
  optionGroups: ProductOptionGroup[]
  toppings: ProductTopping[]
  isAvailable: boolean
  isSoldOut: boolean
  discountPercent: number
  /** Product-specific discount wins if set; global is fallback. Always use this for display. */
  effectiveDiscountPercent?: number
  finalPrice?: number
}

export interface Topping {
  createdAt: string
  id: string
  isActive: boolean
  name: string
  price: string
  sortOrder: number
  updatedAt: string
}

// ─── Tables ───────────────────────────────────────────────────────────────────

export interface Table {
  id: string
  name: string
  capacity: number
  isActive: boolean
}

// ─── Payment ──────────────────────────────────────────────────────────────────

export interface PaymentConfig {
  bankCode: string
  accountNumber: string
  accountName: string
  isEnabled: boolean
}

// ─── Cart ─────────────────────────────────────────────────────────────────────

export interface CartItem {
  cartId: string
  productId: string
  name: string
  basePrice: number
  imageUrl: string | null
  quantity: number
  options: Record<string, string>
  optionDetails?: Array<{ group: string; label: string; priceDelta: number }>
  optionDelta: number
  note: string
  extras?: Array<{ id: string; name: string; price: number }>
}

// ─── Auth / Users ─────────────────────────────────────────────────────────────

export type AdminRole = 'super_admin' | 'staff'

export interface AdminUser {
  id: string
  phone: string
  role: AdminRole
  name?: string | null
  permissions: string[]
}

// ─── Printer ──────────────────────────────────────────────────────────────────

export type PrinterConnection = 'usb' | 'bluetooth' | 'network'
export type PrinterStatus = 'connected' | 'disconnected' | 'connecting' | 'error'

export interface DiscoveredPrinter {
  id: string
  name: string
  connection: PrinterConnection
  /** USB device path, Bluetooth MAC address, or network IP */
  address?: string
  status: PrinterStatus
}

// ─── Bill config ──────────────────────────────────────────────────────────────


export const DEFAULT_BILL_CONFIG: BillConfig = {
  enabled: false,
  printerId: null,
  paperWidth: 80,
  autoPrint: false,
  copies: 1,
  showLogo: true,
  headerText: 'Ujcha Matcha & Coffee',
  footerText: 'Cảm ơn quý khách! Hẹn gặp lại.',
  showQr: true,
  address: '',
  printerName: ''
}


export const DEFAULT_LABEL_CONFIG: LabelConfig = {
  enabled: false,
  printerId: null,
  labelWidth: 50,
  labelHeight: 30,
  autoPrint: false,
  showProductName: true,
  showPrice: true,
  showBarcode: false,
  showNote: true,
  customText: '',
}

// ─── POS app config ───────────────────────────────────────────────────────────

export interface TtsConfig {
  voice: string
  speed: number
  tts_return_option: number
  without_filter: boolean
  token: string
}

export interface PosConfig {
  accessToken: string
  refreshToken: string
  adminUser: AdminUser | null
  /**
   * TTS is kept in PosConfig because it's used at runtime in CheckoutModal
   * (playTts) and is fetched from the admin API — not user-configurable in
   * the settings drawer.
   */
  ttsConfig: TtsConfig
}

export const DEFAULT_CONFIG: PosConfig = {
  accessToken: '',
  refreshToken: '',
  adminUser: null,
  ttsConfig: {
    voice: 'hcm-diemmy',
    speed: 1,
    tts_return_option: 3,
    without_filter: false,
    token: '',
  },
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'delivering'
  | 'arrived'
  | 'cancelled'
  | 'completed'

export type PaymentStatus = 'pending' | 'paid' | 'refunded'

export interface AdminOrderProduct {
  id: string
  name: string
  slug: string
  imageUrls: string[]
  price: string
}

export interface AdminOrderItem {
  id: string
  orderId: string
  productId: string
  quantity: number
  price: string
  extrasJson: unknown[]
  optionsJson: Record<string, string> | null
  note: string | null
  product: AdminOrderProduct
}

export type OrderKind = 'pickup' | 'table' | 'delivery'

export interface TypeDisplay {
  kind: OrderKind
  pickup?: { pickupTime: string }
  table?: { tableId: string; tableName: string }
  delivery?: { address: string; phone: string; name: string }
}

export interface AdminOrder {
  id: string
  orderRef: string
  paymentCode: string
  type: OrderKind

  // Relations (nullable)
  userId: string | null
  addressId: string | null
  tableId: string | null
  shipperId: string | null
  vatConfigId: string | null

  // Pickup / delivery info
  pickupTime: string | null
  guestDeliveryAddress: string | null
  guestDeliveryPhone: string | null
  guestDeliveryName: string | null

  // Pricing — tất cả string từ API trừ finalAmount và totalAmount
  /** Tổng trước giảm giá (string) */
  totalAmount: string
  /** Giảm giá coupon (string) */
  discountAmount: string
  /** Giảm giá bằng điểm (string) */
  pointDiscountAmount: string
  /** Số điểm đang giữ */
  pointsReserved: number
  /** Số điểm đã dùng */
  pointsConsumed: number
  /** Phí vận chuyển (string) */
  shippingFee: string
  /** Thành tiền sau tất cả giảm giá (string) */
  finalAmount: string

  // VAT
  vatRate: string
  vatAmount: string

  // Status
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentType: string

  // Loyalty
  loyaltyQrToken: string | null

  // Timestamps
  paidAt: string | null
  createdAt: string
  updatedAt: string

  // Expanded relations
  table: { name: string; id?: string } | null
  user: { id: string; name: string; email: string; phone?: string | null } | null
  address: { id: string; fullAddress: string; lat?: number | null; lng?: number | null } | null
  shipper: { id: string; name: string } | null

  items: AdminOrderItem[]

  groupOrder: {
    id: string
    token: string
    paymentMode: 'host_pays' | 'split'
    participants: Array<{
      id: string
      userId: string | null
      guestName: string | null
      isHost: boolean
      paymentStatus: 'pending' | 'paid'
      user: { id: string; name: string } | null
      items: Array<{
        id: string
        productId: string
        quantity: number
        unitPrice: string
        selectedOptions: Record<string, string>
        toppingsJson: unknown[]
        note: string | null
        product: { id: string; name: string; imageUrls: string[] }
      }>
    }>
  } | null

  /** Helper từ server, dùng để display */
  typeDisplay?: TypeDisplay
}

// ─── Customer display ─────────────────────────────────────────────────────────

export interface CustomerUpdate {
  type: 'idle' | 'cart' | 'payment' | 'success' | 'ai' | 'ai-mode'
  /** AI cashier text and state */
  text?: string
  state?: 'speaking' | 'listening' | 'idle'
  /** AI mode toggle */
  enabled?: boolean
  name?: string
  items?: Array<{
    name: string
    quantity: number
    price: number
    imageUrl?: string | null
    options?: Record<string, string>
    optionDetails?: Array<{ group: string; label: string; priceDelta: number }>
    extras?: Array<{ id: string; name: string; price: number }>
    note?: string
  }>
  total?: number
  qrUrl?: string
  amount?: number
  bankInfo?: {
    bankCode: string
    accountNumber: string
    accountName: string
  }
}

export type OrderItemExtraSnapshot = {
  toppingId: string;
  name: string;
  price: number;
};

export type QuickDate = 'today' | 'week' | 'all'
