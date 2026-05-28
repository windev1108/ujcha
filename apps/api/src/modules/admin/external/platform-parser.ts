/**
 * Platform order parser (ShopeeFood / GrabFood).
 *
 * Confirmed from live MQTT capture (wss://147.136.146.132:8084/mqtt):
 *
 * Topic /restaurant/{id} — ShopeeFood (foody.vn) restaurant notification
 *   { new: "1"|"0", update: "1"|"0", push_id: string,
 *     target: "action=order&status=N&is_asap=1&code=07056-XXXXX" }
 *
 * Topic /ocha — ShopeeFood broadcast
 *   { order_id: number, push_type: 1|3, extra_data: { order_status: number },
 *     restaurant_id: number, order_code?: string }
 *
 * The MQTT message only carries the order CODE, not full order data.
 * Full order details must be fetched from ShopeeFood/GrabFood REST API.
 * The ingest endpoint accepts the parsed notification + orderCode.
 */

// ─── MQTT notification types (from live capture) ─────────────────────────────

export interface SpfRestaurantPush {
  new?: string        // "1" = new order
  update?: string     // "1" = order update
  push_id?: string
  target?: string     // "action=order&status=N&is_asap=1&code=07056-XXXXX"
  msg?: string        // "Shipper X arrived at merchant"
  order_code?: string
  pushTime?: string
}

export interface SpfOchaPush {
  order_id?: number
  push_type?: number  // 1=order update, 3=merchant status
  extra_data?: {
    order_status?: number
    order_serial?: string
  }
  restaurant_id?: number
  order_code?: string
}

// ─── ShopeeFood full order (from foody.vn REST API) ──────────────────────────

export interface SpfAddOn {
  add_on_id: number
  add_on_name: string
  add_on_price: number    // VND
  quantity: number
}

export interface SpfOrderItem {
  item_id: number
  item_name: string
  quantity: number
  item_price: number      // VND, đơn giá
  subtotal: number        // item_price * quantity
  add_ons?: SpfAddOn[]
  note?: string
}

export interface SpfRecipient {
  name: string
  phone: string
  address: string
  full_address?: string
  lat?: number
  lng?: number
}

export interface SpfFullOrder {
  order_id: number          // internal ShopeeFood ID
  order_code: string        // "07056-XXXXXXXXX" — hiển thị cho merchant
  restaurant_id: number
  order_status: number      // 1=placed, 2=confirmed, 3=preparing, 4=ready, 6=delivered
  order_status_text?: string
  payment_method: number    // 1=cash, 2=prepaid
  is_asap: boolean
  created_time: number      // unix timestamp
  updated_time: number
  scheduled_time?: number   // nếu đặt trước
  recipient: SpfRecipient
  items: SpfOrderItem[]
  subtotal: number          // tổng giá items
  total_amount: number      // sau discount/fee
  discount_amount: number
  shipping_fee: number
  platform_discount?: number
  merchant_discount?: number
  note?: string
}

// ─── GrabFood full order (from GrabFood Merchant API) ────────────────────────

export interface GrabModifier {
  modifierID: string
  modifierName: string
  price: number
  quantity: number
}

export interface GrabOrderItem {
  itemID: string
  itemName: string
  quantity: number
  price: number           // đơn giá VND
  totalPrice: number      // giá * quantity
  modifiers?: GrabModifier[]
  specialInstructions?: string
  isOutOfStock?: boolean
}

export interface GrabBuyer {
  buyerID: string
  displayName: string
  phoneNumber: string     // "+84XXXXXXXXX"
}

export interface GrabDropoffAddress {
  address: string
  coordinates?: { latitude: number; longitude: number }
}

export interface GrabFullOrder {
  orderID: string         // "GRAB-XXXXXXXXXXXX"
  shortOrderNumber?: string
  displayOrderID?: string
  orderState: string      // "PLACED"|"ACCEPTED"|"CANCELLED"|"DRIVER_ALLOCATED"|"DELIVERED"
  orderType: string       // "INSTANT"|"SCHEDULED"
  currencyCode: string    // "VND"
  merchantID: string
  displayItems: GrabOrderItem[]
  subtotal: number        // VND
  discount: number
  shippingFee: number
  totalOrderValue: number
  buyer: GrabBuyer
  dropoffAddress: GrabDropoffAddress
  specialInstructions?: string
  estimatedReadyTime?: string  // ISO8601
  createdTime: string
  updatedTime: string
  scheduledTime?: string
}

// ─── Normalized form used internally ─────────────────────────────────────────

export interface PlatformItem {
  name: string
  quantity: number
  unitPrice: number
  options?: string[]
  note?: string
}

export interface PlatformOrder {
  externalOrderId?: string
  platform?: string       // "shopee"|"grab"|"baemin"|"external"
  orderCode?: string      // "07056-XXXXX" or "GRAB-XXXXX"
  restaurantId?: string   // platform restaurant ID
  customerName?: string
  customerPhone?: string
  deliveryAddress?: string
  items: PlatformItem[]
  subtotal?: number
  discount?: number
  total?: number
  paymentMethod?: string
  note?: string
}

export interface ParseResult {
  raw: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: Record<string, any> | null
  order: PlatformOrder | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unmapped: Record<string, any>
  parseError?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function str(v: any): string | undefined {
  if (v == null) return undefined
  const s = String(v).trim()
  return s || undefined
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function num(v: any): number | undefined {
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractItems(raw: any): PlatformItem[] {
  const list = Array.isArray(raw) ? raw : []
  const result: PlatformItem[] = []
  for (const it of list) {
    if (!it || typeof it !== 'object') continue
    const name =
      str(it.item_name) ?? str(it.itemName) ??
      str(it.name) ?? str(it.product_name) ?? str(it.productName)
    if (!name) continue
    const quantity = num(it.quantity) ?? num(it.qty) ?? 1
    const unitPrice =
      num(it.item_price) ?? num(it.price) ??
      num(it.unit_price) ?? num(it.unitPrice) ??
      // GrabFood v3: fare.priceFloat hoặc fare.priceInMin
      num(it.fare?.priceFloat) ?? num(it.fare?.priceInMin) ?? 0
    const options: string[] = []
    // ShopeeFood add_ons
    if (Array.isArray(it.add_ons)) {
      for (const ao of it.add_ons) {
        const v = str(ao?.add_on_name) ?? str(ao?.name)
        if (v) options.push(v)
      }
    }
    // GrabFood modifiers (v2 - flat list on item)
    if (Array.isArray(it.modifiers)) {
      for (const m of it.modifiers) {
        const v = str(m?.modifierName) ?? str(m?.name)
        if (v) options.push(v)
      }
    }
    // GrabFood modifiers (v3 - grouped: item.modifierGroups[].modifiers[])
    if (Array.isArray(it.modifierGroups)) {
      for (const grp of it.modifierGroups) {
        if (Array.isArray(grp?.modifiers)) {
          for (const m of grp.modifiers) {
            const v = str(m?.modifierName) ?? str(m?.name)
            if (v) options.push(v)
          }
        }
      }
    }
    // Generic options array
    if (Array.isArray(it.options)) {
      for (const o of it.options) {
        if (typeof o === 'string') options.push(o)
        else if (o?.name) options.push(String(o.name))
      }
    }
    result.push({
      name,
      quantity,
      unitPrice,
      options: options.length ? options : undefined,
      // GrabFood v3 dùng comment thay vì note/specialInstructions
      note: str(it.note) ?? str(it.comment) ?? str(it.specialInstructions) ?? str(it.special_instructions),
    })
  }
  return result
}

// ─── Parse ShopeeFood full order ─────────────────────────────────────────────

export function parseSpfOrder(order: SpfFullOrder): PlatformOrder {
  return {
    externalOrderId: String(order.order_id),
    platform: 'shopee',
    orderCode: order.order_code,
    restaurantId: String(order.restaurant_id),
    customerName: order.recipient?.name,
    customerPhone: order.recipient?.phone,
    deliveryAddress: order.recipient?.full_address ?? order.recipient?.address,
    items: extractItems(order.items),
    subtotal: order.subtotal,
    discount: order.discount_amount,
    total: order.total_amount,
    paymentMethod: order.payment_method === 2 ? 'prepaid' : 'cash',
    note: order.note,
  }
}

// ─── Parse GrabFood full order ────────────────────────────────────────────────

export function parseGrabOrder(order: GrabFullOrder): PlatformOrder {
  return {
    externalOrderId: order.orderID,
    platform: 'grab',
    orderCode: order.displayOrderID ?? order.orderID,
    customerName: order.buyer?.displayName,
    customerPhone: order.buyer?.phoneNumber,
    deliveryAddress: order.dropoffAddress?.address,
    items: extractItems(order.displayItems),
    discount: order.discount,
    total: order.totalOrderValue,
    paymentMethod: 'prepaid', // GrabFood luôn prepaid
    note: order.specialInstructions,
  }
}

// ─── Generic parser (fallback) ───────────────────────────────────────────────

export function parsePlatformMessage(raw: string): ParseResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: Record<string, any> | null = null
  let parseError: string | undefined

  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      json = parsed
    } else {
      parseError = 'Root JSON is not an object'
    }
  } catch (e) {
    parseError = e instanceof Error ? e.message : 'JSON parse error'
    return { raw, json: null, order: null, unmapped: {}, parseError }
  }

  if (!json) return { raw, json: null, order: null, unmapped: {}, parseError }

  // Unwrap nested wrappers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: Record<string, any> = json
  if (json.data && typeof json.data === 'object') data = json.data as typeof data
  else if (json.payload && typeof json.payload === 'object') data = json.payload as typeof data
  else if (json.order && typeof json.order === 'object') data = json.order as typeof data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unmapped: Record<string, any> = {}

  const externalOrderId =
    str(data.order_id) ?? str(data.orderId) ?? str(data.id) ?? str(data.externalId) ??
    // GrabFood v3
    str(data.orderID)
  const platform =
    str(data.platform) ?? str(data.source) ?? str(json.source)
  const customerName =
    str(data.customer_name) ?? str(data.customerName) ??
    str(data.recipient?.name) ?? str(data.buyer?.displayName) ??
    // GrabFood v3: tên khách trong eater (có thể là "***" do ẩn danh)
    str(data.eater?.name)
  const customerPhone =
    str(data.customer_phone) ?? str(data.customerPhone) ??
    str(data.recipient?.phone) ?? str(data.buyer?.phoneNumber)
  const deliveryAddress =
    str(data.delivery_address) ?? str(data.deliveryAddress) ??
    str(data.recipient?.full_address) ?? str(data.recipient?.address) ??
    str(data.dropoffAddress?.address)
  const items = extractItems(
    data.items ?? data.displayItems ?? data.order_items ?? data.products ??
    // GrabFood v3: items nằm trong itemInfo.items
    data.itemInfo?.items ?? [],
  )
  const subtotal = num(data.subtotal) ?? num(data.sub_total)
  const discount = num(data.discount) ?? num(data.discount_amount)
  const total =
    num(data.total) ?? num(data.total_amount) ?? num(data.totalOrderValue) ??
    // GrabFood v3: originalPriceInMin = giá gốc chưa giảm (VND)
    num(data.fare?.originalPriceInMin)
  const paymentMethod =
    str(data.payment_method) ?? str(data.paymentMethod) ??
    // GrabFood v3
    str(data.paymentMethod ?? data.payment_method)
  const note =
    str(data.note) ?? str(data.remark) ?? str(data.specialInstructions) ??
    // GrabFood v3: ghi chú giao hàng từ khách trong eater.comment
    str(data.eater?.comment)

  const known = new Set([
    'order_id', 'orderId', 'id', 'externalId', 'orderID',
    'platform', 'source',
    'customer_name', 'customerName', 'recipient', 'buyer', 'eater',
    'customer_phone', 'customerPhone',
    'delivery_address', 'deliveryAddress', 'dropoffAddress',
    'items', 'displayItems', 'order_items', 'products', 'itemInfo',
    'subtotal', 'sub_total', 'discount', 'discount_amount',
    'total', 'total_amount', 'totalOrderValue', 'fare',
    'payment_method', 'paymentMethod',
    'note', 'remark', 'specialInstructions',
  ])
  for (const [k, v] of Object.entries(data)) {
    if (!known.has(k)) unmapped[k] = v
  }
  if (json.event) unmapped['_event'] = json.event
  if (json.type) unmapped['_type'] = json.type

  const order: PlatformOrder = {
    externalOrderId, platform, customerName, customerPhone,
    deliveryAddress, items, subtotal, discount, total, paymentMethod, note,
  }

  return { raw, json, order, unmapped, parseError }
}
