import { app } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'
import { readSubConfig, writeSubConfig } from '../renderer/src/store/config-store'

// Analy partner API
const ANALY_API = 'https://api.analy.co'
// GrabFood global API (used by merchant.grab.com/portal)
const GRAB_API_BASE = 'https://api.grab.com'
// Legacy direct-login API origin (Vietnam)
const GRAB_API_ORIGIN = 'https://gmerchant.deliverynow.vn'
// Default connector ID (Analy uses @@GRAB_BRANCH_N@@ convention)
const DEFAULT_CONNECTOR_ID = '@@GRAB_BRANCH_1@@'

/** Build daily-pagination URL. Defaults to today in Vietnam timezone (UTC+7). */
function getDailyPaginationUrl(startDate?: string, endDate?: string, pageIndex = 0): string {
  const now = new Date()
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const today = vn.toISOString().slice(0, 10)
  const sd = startDate ?? today
  const ed = endDate ?? today
  const start = encodeURIComponent(`${sd}T00:00:00+07:00`)
  const end = encodeURIComponent(`${ed}T23:59:59+07:00`)
  return `${GRAB_API_BASE}/delvplatformapi/merchant/v1/reports/daily-pagination?states=&startTime=${start}&endTime=${end}&pageIndex=${pageIndex}&pageSize=50`
}

/** Build orders-pagination (PreparingV2) URL for real-time order detection. */
function getOrdersPaginationUrl(merchantID: string, pageType: string, searchToken = ''): string {
  return `${GRAB_API_BASE}/delvplatformapi/merchant/v4/orders-pagination?AutoAcceptGroup=1&merchantID=${encodeURIComponent(merchantID)}&PageType=${encodeURIComponent(pageType)}&searchToken=${encodeURIComponent(searchToken)}&size=50`
}

const POLL_INTERVAL_MS = 5_000

// ─── State ────────────────────────────────────────────────────────────────────

let pollTimer: ReturnType<typeof setInterval> | null = null
let lastKnownOrderIds = new Set<string>()
let lastPollTime: string | null = null
let lastPollStatus: 'ok' | 'auth_error' | 'error' | 'idle' = 'idle'
let cachedHeaders: Record<string, string> | null = null
let connectedMerchantName: string | null = null
let cachedMerchantID: string | null = null
let cachedMerchantGroupID: string | null = null
let cachedGrabId: string | null = null
let cachedMerchantEmail: string | null = null
let cachedMerchantRole: string | null = null
let cachedMerchantDisplayRole: string | null = null
let nextSearchToken = ''

// ─── Analy config (same as socket.ts) ────────────────────────────────────────

const ANALY_CONFIG_PATH = join(app.getPath('appData'), 'Analy', 'config.json')

interface AnalyConfig {
  User?: { UserAccessToken?: string; UserEmail?: string }
}

function readAnalyToken(): string | null {
  try {
    const raw = readFileSync(ANALY_CONFIG_PATH, 'utf-8')
    const cfg = JSON.parse(raw) as AnalyConfig
    return cfg.User?.UserAccessToken ?? null
  } catch {
    return null
  }
}

// ─── Grab config (credentials + cached headers) ───────────────────────────────

interface GrabConfig {
  username?: string
  connectorId?: string
  headersMap?: Record<string, string>
  merchantName?: string
  merchantID?: string
  merchantGroupID?: string
  grabId?: string
  email?: string
  role?: string
  displayRole?: string
  savedAt?: string
  pollIntervalMs?: number
}

function getGrabConfig(): GrabConfig {
  return (readSubConfig('grabSetting') as GrabConfig | null) ?? {}
}

function saveGrabConfig(patch: Partial<GrabConfig>) {
  writeSubConfig('grabSetting', { ...getGrabConfig(), ...patch })
}

function getPollIntervalMs(): number {
  const saved = getGrabConfig().pollIntervalMs
  if (saved && saved >= 3000 && saved <= 60000) return saved
  return POLL_INTERVAL_MS
}

// ─── Analy partner API calls ──────────────────────────────────────────────────

interface GrabConnector {
  connectorId: string
  connectorLoginKey?: string
  merchantId?: string
  merchantName?: string
  headersMap?: Record<string, string>
}

async function fetchGrabConnectors(analyToken: string): Promise<GrabConnector[]> {
  try {
    const res = await fetch(`${ANALY_API}/api/partner/v2/grab_connectors`, {
      headers: { 'Authorization': `Bearer ${analyToken}`, 'Content-Type': 'application/json' },
    })
    const text = await res.text()
    console.log('[GrabFood] grab_connectors HTTP', res.status, text)
    if (!res.ok) return []
    const data = JSON.parse(text) as { value?: GrabConnector[] } | GrabConnector[]
    if (Array.isArray(data)) return data
    return (data as { value?: GrabConnector[] }).value ?? []
  } catch (e) {
    console.error('[GrabFood] fetchGrabConnectors error:', e)
    return []
  }
}

export interface GrabConnectResult {
  ok: boolean
  connected: boolean
  needsOtp?: boolean
  stores: { storeId: string; storeName: string }[]
  error?: string
}

export async function syncGrabSession(): Promise<GrabConnectResult & { connectors?: GrabConnector[] }> {
  const analyToken = readAnalyToken()
  if (!analyToken) {
    return { ok: false, connected: false, stores: [], error: 'Chưa đăng nhập Analy — không đọc được token' }
  }
  const connectors = await fetchGrabConnectors(analyToken)
  console.log('[GrabFood] syncFromAnaly connectors:', JSON.stringify(connectors))
  const connector = connectors.find(c => c.headersMap && Object.keys(c.headersMap).length > 0) ?? connectors[0]
  if (connector?.headersMap && Object.keys(connector.headersMap).length > 0) {
    // Save connectorId first so it's preserved when saveGrabAuthHeaders patches config
    saveGrabConfig({ connectorId: connector.connectorId })
    if (connector.merchantId) cachedMerchantID = connector.merchantId
    // saveGrabAuthHeaders fetches the merchant profile → extracts merchantName + merchantID
    const name = await saveGrabAuthHeaders(connector.headersMap)
    if (name) connectedMerchantName = name
    console.log('[GrabFood] Synced from Analy, merchant:', connectedMerchantName, 'merchantID:', cachedMerchantID)
    return { ok: true, connected: true, stores: [] }
  }
  // headersMap empty — try auto-login using connectorLoginKey stored in Analy
  if (connector?.connectorLoginKey) {
    console.log('[GrabFood] headersMap empty, trying auto-connect with connectorLoginKey:', connector.connectorLoginKey)
    const cfg = getGrabConfig()
    const savedPassword = cfg.username === connector.connectorLoginKey ? undefined : undefined
    // We don't have the password — return connector info so UI can pre-fill username
    return {
      ok: true,
      connected: false,
      stores: [],
      connectors,
      error: `Connector chưa xác thực — thử đăng nhập với username "${connector.connectorLoginKey}"`,
    }
  }
  return {
    ok: true,
    connected: false,
    stores: [],
    connectors,
    error: 'Không tìm thấy connector GrabFood trong Analy',
  }
}

export async function connectGrabByCredentials(
  username: string,
  password: string,
  _otp?: string,
): Promise<GrabConnectResult> {
  // Try direct GrabFood merchant login, bypassing Analy partner API
  const CANDIDATE_ENDPOINTS = [
    { url: `${GRAB_API_ORIGIN}/api/v2/member/login`, body: { username, password } },
    { url: `${GRAB_API_ORIGIN}/api/v1/merchant/login`, body: { username, password } },
    { url: `${GRAB_API_ORIGIN}/api/v2/merchant/login`, body: { username, password } },
    { url: `${GRAB_API_ORIGIN}/api/v1/auth/login`, body: { username, password } },
    { url: `${GRAB_API_ORIGIN}/api/v1/partner/login`, body: { partner_name: username, partner_password: password } },
    { url: `${GRAB_API_ORIGIN}/api/v2/auth/token`, body: { username, password, grant_type: 'password' } },
  ]

  const BASE_HEADERS = {
    'Content-Type': 'application/json',
    'Origin': GRAB_API_ORIGIN,
    'Referer': `${GRAB_API_ORIGIN}/`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  }

  for (const ep of CANDIDATE_ENDPOINTS) {
    try {
      const res = await fetch(ep.url, {
        method: 'POST',
        headers: BASE_HEADERS,
        body: JSON.stringify(ep.body),
      })
      const text = await res.text()
      console.log(`[GrabFood] ${ep.url} → ${res.status}: ${text.slice(0, 300)}`)

      if (!res.ok) continue

      let data: Record<string, unknown>
      try { data = JSON.parse(text) as Record<string, unknown> } catch { continue }

      // Extract token from common response shapes
      const token = (data['token'] ?? data['access_token'] ?? data['accessToken'] ??
        (data['data'] as Record<string, unknown>)?.['token'] ??
        (data['data'] as Record<string, unknown>)?.['access_token']) as string | undefined

      // Extract Set-Cookie from response headers
      const setCookie = res.headers.get('set-cookie')

      if (!token && !setCookie) {
        console.log(`[GrabFood] ${ep.url} returned 200 but no token/cookie found`)
        continue
      }

      const headersMap: Record<string, string> = {}
      if (token) headersMap['Authorization'] = `Bearer ${token}`
      if (setCookie) headersMap['Cookie'] = setCookie.split(';')[0] // first cookie value

      connectedMerchantName = username
      saveGrabConfig({ username, headersMap, merchantName: username, savedAt: new Date().toISOString() })
      cachedHeaders = headersMap
      console.log('[GrabFood] Direct login success via', ep.url)
      return { ok: true, connected: true, stores: [] }
    } catch (err) {
      console.log(`[GrabFood] ${ep.url} error:`, String(err))
    }
  }

  return {
    ok: false,
    connected: false,
    stores: [],
    error: 'Không tìm được endpoint đăng nhập GrabFood — xem console log để debug',
  }
}

async function refreshHeaders(): Promise<boolean> {
  const analyToken = readAnalyToken()
  if (!analyToken) return false

  const cfg = getGrabConfig()
  const connectorId = cfg.connectorId ?? DEFAULT_CONNECTOR_ID

  const connectors = await fetchGrabConnectors(analyToken)
  const connector = connectors.find(c => c.connectorId === connectorId) ?? connectors[0]

  if (connector?.headersMap && Object.keys(connector.headersMap).length > 0) {
    cachedHeaders = connector.headersMap
    connectedMerchantName = connector.merchantName ?? cfg.merchantName ?? null
    saveGrabConfig({ headersMap: connector.headersMap, merchantName: connectedMerchantName ?? undefined })
    return true
  }

  return false
}

// ─── Order polling ────────────────────────────────────────────────────────────

interface GrabOrderEntry {
  // daily-pagination fields
  ID?: string
  deliveryStatus?: string
  createdAt?: string
  bookingCode?: string
  displayID?: string
  // orders-pagination legacy fields
  orderID?: string
  order_id?: string
  shortOrderID?: string
  orderState?: string
  order_state?: string
  orderStatus?: string
  status?: string
  [key: string]: unknown
}

// api.grab.com/delvplatformapi/merchant/v1/reports/daily-pagination response
interface GrabOrderListResponse {
  statements?: GrabOrderEntry[]
  hasMore?: boolean
  pageIndex?: number
  pageSize?: number
  // legacy fallbacks
  orders?: GrabOrderEntry[]
  nextCursor?: string
  code?: number
  data?: { orderList?: GrabOrderEntry[]; order_list?: GrabOrderEntry[]; orders?: GrabOrderEntry[] }
}

// orders-pagination v4 (PreparingV2) response types
export interface GrabPreparingOrder {
  orderID: string
  displayID: string
  state: string
  orderValue: string
  eater: { ID: number; name: string }
  itemInfo: {
    count: number
    items: Array<{ itemID?: string; name: string; quantity: number; comment?: string }>
  }
  times: { createdAt: string; estimatedPickUpTime?: string }
  labels?: { isRead: boolean; acceptedViaAA?: boolean }
  preparationTaskpoolStatus?: string
  preparationTaskID?: string
  mexOPT?: { submittedOPTFromMex?: number; estimatedOPTDoneAt?: string }
  [key: string]: unknown
}

interface GrabPreparingOrdersResponse {
  orders?: GrabPreparingOrder[]
  pollInterval?: number
  nextSearchToken?: string
  orderStats?: { unreadAANumberInPrepare?: number; numberInPrepare?: number }
}

function extractOrderId(order: GrabOrderEntry): string | undefined {
  return (order.ID ?? order.orderID ?? order.order_id ?? order.shortOrderID) as string | undefined
}

function extractOrders(data: GrabOrderListResponse): GrabOrderEntry[] {
  return data.statements ?? data.orders ?? data.data?.orders ?? data.data?.orderList ?? data.data?.order_list ?? []
}

function isNewOrder(order: GrabOrderEntry): boolean {
  const status = (order.deliveryStatus ?? order.orderStatus ?? order.orderState ?? order.order_state ?? order.status ?? '').toString().toUpperCase()
  if (!status) return true
  return status !== 'COMPLETED' && status !== 'CANCELLED' && status !== 'CANCELED' && status !== 'FAILED'
}

function getActiveHeaders(): Record<string, string> | null {
  if (cachedHeaders && Object.keys(cachedHeaders).length > 0) return cachedHeaders
  const saved = getGrabConfig().headersMap
  if (saved && Object.keys(saved).length > 0) {
    cachedHeaders = saved
    return cachedHeaders
  }
  return null
}

function buildReqHeaders(cleanHeaders: Record<string, string>): Record<string, string> {
  return {
    'Accept': 'application/json',
    'Accept-Language': 'vi',
    'Origin': 'https://merchant.grab.com',
    'Referer': 'https://merchant.grab.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    ...cleanHeaders,
  }
}

async function fetchOrders(): Promise<{ orders: GrabOrderEntry[]; authError: boolean }> {
  const headers = getActiveHeaders()
  if (!headers) return { orders: [], authError: true }

  const pollUrl = getDailyPaginationUrl()
  const cleanHeaders: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    if (!k.startsWith('_')) cleanHeaders[k] = v
  }

  try {
    const res = await fetch(pollUrl, { method: 'GET', headers: buildReqHeaders(cleanHeaders) })
    console.log('[GrabFood] daily-pagination GET status:', res.status)

    if (res.status === 401 || res.status === 403) return { orders: [], authError: true }
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn('[GrabFood] daily-pagination error:', res.status, text.slice(0, 200))
      return { orders: [], authError: false }
    }

    const body = await res.json() as GrabOrderListResponse
    console.log('[GrabFood] daily-pagination — statements:', (body.statements ?? []).length, 'hasMore:', body.hasMore)
    return { orders: extractOrders(body), authError: false }
  } catch (err) {
    console.error('[GrabFood] Fetch error:', err)
    return { orders: [], authError: false }
  }
}

async function fetchPreparingOrders(): Promise<{ orders: GrabPreparingOrder[]; authError: boolean; nextToken?: string }> {
  const headers = getActiveHeaders()
  if (!headers) return { orders: [], authError: true }

  const merchantID = cachedMerchantID ?? getGrabConfig().merchantID
  if (!merchantID) return { orders: [], authError: false }

  const cleanHeaders: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    if (!k.startsWith('_')) cleanHeaders[k] = v
  }

  try {
    const url = getOrdersPaginationUrl(merchantID, 'PreparingV2', nextSearchToken)
    const res = await fetch(url, { method: 'GET', headers: buildReqHeaders(cleanHeaders) })
    console.log('[GrabFood] orders-pagination GET status:', res.status)

    if (res.status === 401 || res.status === 403) return { orders: [], authError: true }
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn('[GrabFood] orders-pagination error:', res.status, text.slice(0, 200))
      return { orders: [], authError: false }
    }

    const body = await res.json() as GrabPreparingOrdersResponse
    console.log('[GrabFood] orders-pagination — orders:', (body.orders ?? []).length, 'nextToken:', body.nextSearchToken)
    return { orders: body.orders ?? [], authError: false, nextToken: body.nextSearchToken }
  } catch (err) {
    console.error('[GrabFood] Fetch error:', err)
    return { orders: [], authError: false }
  }
}

async function fetchOrderDetail(orderId: string): Promise<Record<string, unknown> | null> {
  const headers = getActiveHeaders()
  if (!headers) return null

  const cleanHeaders: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    if (!k.startsWith('_')) cleanHeaders[k] = v
  }

  try {
    const res = await fetch(
      `${GRAB_API_BASE}/food/merchant/v3/orders/${orderId}`,
      { method: 'GET', headers: buildReqHeaders(cleanHeaders) },
    )
    if (!res.ok) {
      console.warn('[GrabFood] order detail error:', res.status, orderId)
      return null
    }
    const body = await res.json() as { order?: Record<string, unknown> }
    return body.order ?? null
  } catch (err) {
    console.error('[GrabFood] fetchOrderDetail error:', err)
    return null
  }
}

async function runPoll() {
  const merchantID = cachedMerchantID ?? getGrabConfig().merchantID
  // Use orders-pagination (PreparingV2) when merchantID is known; fall back to daily-pagination
  if (merchantID) {
    const { orders, authError, nextToken } = await fetchPreparingOrders()
    lastPollTime = new Date().toISOString()

    if (authError) {
      lastPollStatus = 'auth_error'
      console.warn('[GrabFood] Auth error — cần kết nối lại GrabFood')
      return
    }

    lastPollStatus = 'ok'
    if (nextToken !== undefined) nextSearchToken = nextToken

    for (const order of orders) {
      const id = order.orderID
      if (!id || lastKnownOrderIds.has(id)) continue
      lastKnownOrderIds.add(id)
      console.log('[GrabFood] New preparing order:', id, order.displayID)
      _onNewOrderCb?.(id)
    }
  } else {
    // Fallback: daily-pagination (misses orders before delivery state)
    const { orders, authError } = await fetchOrders()
    lastPollTime = new Date().toISOString()

    if (authError) {
      lastPollStatus = 'auth_error'
      console.warn('[GrabFood] Auth error — cần kết nối lại GrabFood')
      return
    }

    lastPollStatus = 'ok'

    for (const order of orders) {
      const id = extractOrderId(order)
      if (!id || lastKnownOrderIds.has(id)) continue
      if (!isNewOrder(order)) continue
      lastKnownOrderIds.add(id)
      console.log('[GrabFood] New order detected:', id)
      _onNewOrderCb?.(id)
    }
  }
}

// ─── New-order callback (for notifications, no ingest) ───────────────────────

let _onNewOrderCb: ((id: string) => void) | null = null

export function setOnNewOrderCallback(cb: (id: string) => void) {
  _onNewOrderCb = cb
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Try to extract merchantID from a JWT Bearer token (base64url payload). */
function extractMerchantIdFromJwt(token: string): string | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const pad = (s: string) => s + '='.repeat((4 - (s.length % 4)) % 4)
    const payload = JSON.parse(
      Buffer.from(pad(parts[1]).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8'),
    ) as Record<string, unknown>
    const id = (payload.mid ?? payload.mex_id ?? payload.merchant_id ?? payload.merchantId) as string | undefined
    // Grab merchant IDs look like "5-XXXXXXXX" — must contain a dash
    return id && String(id).includes('-') ? String(id) : null
  } catch { return null }
}

export async function saveGrabAuthHeaders(headersMap: Record<string, string>): Promise<string | null> {
  cachedHeaders = headersMap
  let extractedMerchantID: string | null = null

  // 1. Try to decode from Bearer JWT token (fastest, no HTTP request)
  const bearer = headersMap['Authorization']?.replace(/^Bearer\s+/i, '')
  if (bearer) extractedMerchantID = extractMerchantIdFromJwt(bearer)
  console.log('[GrabFood] JWT merchantID:', extractedMerchantID)

  // 2. Try merchant profile APIs — portal catalog-stores first (most reliable)
  if (!extractedMerchantID) {
    const profileUrls = [
      // portal.grab.com returns { merchants: [{ merchantID, merchantName }] }
      'https://portal.grab.com/foodtroy/v1/VN/merchant-groups/catalog-stores?offset=0&limit=100',
      'https://api.grab.com/food/merchant/v1/restaurants',
      'https://api.grab.com/food/merchant/v1/merchant',
      'https://api.grab.com/food/merchant/v1/merchant-profile',
      'https://api.grab.com/delvplatformapi/merchant/v1/merchant-info',
      'https://api.grab.com/delvplatformapi/merchant/v1/merchant-setting',
    ]
    for (const url of profileUrls) {
      try {
        const origin = url.startsWith('https://portal.grab.com') ? 'https://portal.grab.com' : 'https://merchant.grab.com'
        const res = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            'Origin': origin,
            'Referer': `${origin}/`,
            ...headersMap,
          },
        })
        if (res.ok) {
          const raw = await res.json() as Record<string, unknown> | unknown[]
          console.log('[GrabFood] Profile', url, '→', JSON.stringify(raw).slice(0, 300))

          // portal catalog-stores: { merchants: [{ merchantID, merchantName, merchantGroupID }] }
          const merchantsArr = Array.isArray((raw as Record<string, unknown>).merchants)
            ? ((raw as Record<string, unknown>).merchants as Record<string, unknown>[])
            : null
          if (merchantsArr && merchantsArr.length > 0) {
            const first = merchantsArr[0]
            const candidate = (first.merchantID ?? first.merchantId) as string | undefined
            if (candidate && String(candidate).includes('-')) extractedMerchantID = String(candidate)
            if (!connectedMerchantName)
              connectedMerchantName = (first.merchantName ?? first.name) as string | null ?? null
            // Also capture merchantGroupID for user-profile API
            const groupId = (first.merchantGroupID ?? first.merchantGroupId ?? (raw as Record<string, unknown>).merchantGroupID) as string | undefined
            if (groupId && !cachedMerchantGroupID) cachedMerchantGroupID = String(groupId)
            if (extractedMerchantID) break
          }

          // Array root (restaurants API returns [{ID, name, ...}] or {data:[...]})
          const arr: Record<string, unknown>[] | null = Array.isArray(raw)
            ? (raw as Record<string, unknown>[])
            : Array.isArray((raw as Record<string, unknown>).data)
              ? ((raw as Record<string, unknown>).data as Record<string, unknown>[])
              : null

          if (arr && arr.length > 0) {
            const first = arr[0]
            if (!connectedMerchantName)
              connectedMerchantName = (first.name ?? first.restaurantName ?? first.merchant_name) as string | null ?? null
            const candidate = (first.ID ?? first.merchantID ?? first.merchantId ?? first.merchant_id) as string | undefined
            if (candidate && String(candidate).includes('-')) extractedMerchantID = String(candidate)
          } else if (!Array.isArray(raw)) {
            const nested = ((raw as Record<string, unknown>).data ?? (raw as Record<string, unknown>).merchant ?? raw) as Record<string, unknown>
            if (!connectedMerchantName)
              connectedMerchantName = (nested.name ?? nested.merchantName ?? nested.merchant_name) as string | null ?? null
            const candidate = (
              nested.merchantID ?? nested.merchantId ?? nested.merchant_id ??
              nested.ID ?? nested.id ??
              (raw as Record<string, unknown>).merchantID ?? (raw as Record<string, unknown>).merchantId ?? (raw as Record<string, unknown>).ID
            ) as string | undefined
            if (candidate && String(candidate).includes('-')) extractedMerchantID = String(candidate)
          }

          if (connectedMerchantName && extractedMerchantID) break
        }
      } catch { /* ignore */ }
    }
  }

  if (extractedMerchantID) cachedMerchantID = extractedMerchantID

  // Extract grab-id and _merchantGroupID from CDP-captured headers
  const grabId = headersMap['grab-id'] ?? headersMap['Grab-Id'] ?? headersMap['Grab-ID'] ?? null
  if (grabId) cachedGrabId = grabId
  const capturedGroupId = headersMap['_merchantGroupID'] ?? null
  if (capturedGroupId && !cachedMerchantGroupID) cachedMerchantGroupID = capturedGroupId

  // Call merchant.grab.com/user-profile for richer info (name, email, role, grab_food_entity_id)
  if (cachedMerchantGroupID || grabId) {
    const mgId = cachedMerchantGroupID ?? ''
    const profileUrl = `https://merchant.grab.com/user-profile/v2/details?merchant_group_id=${encodeURIComponent(mgId)}&currency=VND`
    try {
      const res = await fetch(profileUrl, {
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://merchant.grab.com',
          'Referer': 'https://merchant.grab.com/',
          ...headersMap,
        },
      })
      if (res.ok) {
        const data = await res.json() as Record<string, unknown>
        console.log('[GrabFood] user-profile →', JSON.stringify(data).slice(0, 400))
        const profile = ((data.user_profile ?? data) as Record<string, unknown>)
        // Extract merchantID if not yet found
        if (!extractedMerchantID) {
          const gfId = profile.grab_food_entity_id as string | undefined
          if (gfId && String(gfId).includes('-')) { extractedMerchantID = String(gfId); cachedMerchantID = extractedMerchantID }
        }
        const email = profile.correspondence_email as string | undefined
        const role = profile.role as string | undefined
        const displayRole = profile.display_role as string | undefined
        const fullName = profile.full_name as string | undefined
        if (email) cachedMerchantEmail = email
        if (role) cachedMerchantRole = role
        if (displayRole) cachedMerchantDisplayRole = displayRole
        if (fullName && !connectedMerchantName) connectedMerchantName = fullName
      }
    } catch { /* ignore */ }
  }

  // Only persist merchantID when we actually found one — never overwrite with undefined
  saveGrabConfig({
    headersMap,
    merchantName: connectedMerchantName ?? undefined,
    ...(extractedMerchantID ? { merchantID: extractedMerchantID } : {}),
    ...(cachedMerchantGroupID ? { merchantGroupID: cachedMerchantGroupID } : {}),
    ...(cachedGrabId ? { grabId: cachedGrabId } : {}),
    ...(cachedMerchantEmail ? { email: cachedMerchantEmail } : {}),
    ...(cachedMerchantRole ? { role: cachedMerchantRole } : {}),
    ...(cachedMerchantDisplayRole ? { displayRole: cachedMerchantDisplayRole } : {}),
    savedAt: new Date().toISOString(),
  })
  console.log('[GrabFood] Auth saved — merchant:', connectedMerchantName, '| merchantID:', extractedMerchantID ?? cachedMerchantID ?? '(not found)')
  return connectedMerchantName
}

/** Manually set the Grab merchant ID (e.g. from Settings UI). */
export function setGrabMerchantId(id: string): void {
  cachedMerchantID = id.trim()
  saveGrabConfig({ merchantID: cachedMerchantID })
  console.log('[GrabFood] Merchant ID manually set:', cachedMerchantID)
}

let _savedIngestUrl = ''
let _savedInternalKey = ''

export function startGrabPolling(ingestUrl = '', internalKey = '') {
  if (ingestUrl) _savedIngestUrl = ingestUrl
  if (internalKey) _savedInternalKey = internalKey
  if (pollTimer) return

  const cfg = getGrabConfig()
  if (cfg.headersMap && Object.keys(cfg.headersMap).length > 0) {
    cachedHeaders = cfg.headersMap
    connectedMerchantName = cfg.merchantName ?? null
  }
  if (cfg.merchantID) cachedMerchantID = cfg.merchantID
  if (cfg.merchantGroupID) cachedMerchantGroupID = cfg.merchantGroupID
  if (cfg.grabId) cachedGrabId = cfg.grabId
  if (cfg.email) cachedMerchantEmail = cfg.email
  if (cfg.role) cachedMerchantRole = cfg.role
  if (cfg.displayRole) cachedMerchantDisplayRole = cfg.displayRole

  if (!getActiveHeaders()) {
    console.log('[GrabFood] No auth headers — polling disabled until connected')
    return
  }

  void runPoll()
  const interval = getPollIntervalMs()
  pollTimer = setInterval(() => void runPoll(), interval)
  const mode = cachedMerchantID ? 'PreparingV2' : 'daily-pagination (fallback)'
  console.log(`[GrabFood] Polling started [${mode}], interval=${interval / 1000}s`)
}

export function applyPollInterval(ms: number) {
  const clamped = Math.min(60000, Math.max(3000, ms))
  saveGrabConfig({ pollIntervalMs: clamped })
  if (pollTimer) {
    stopGrabPolling()
    startGrabPolling(_savedIngestUrl, _savedInternalKey)
  }
}

export function resumeGrabPolling() {
  if (pollTimer) { stopGrabPolling() }
  startGrabPolling()
}

export function stopGrabPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export function resetGrabSession() {
  stopGrabPolling()
  cachedHeaders = null
  connectedMerchantName = null
  cachedMerchantID = null
  cachedMerchantGroupID = null
  cachedGrabId = null
  cachedMerchantEmail = null
  cachedMerchantRole = null
  cachedMerchantDisplayRole = null
  nextSearchToken = ''
  lastKnownOrderIds.clear()
  lastPollTime = null
  lastPollStatus = 'idle'
  writeSubConfig('grabSetting', {})
  console.log('[GrabFood] Session reset')
}

export interface GrabStatus {
  polling: boolean
  lastPollTime: string | null
  lastPollStatus: 'ok' | 'auth_error' | 'error' | 'idle'
  hasAuth: boolean
  merchantName: string | null
  merchantID: string | null
  merchantGroupID: string | null
  grabId: string | null
  email: string | null
  role: string | null
  displayRole: string | null
  pollIntervalMs: number
}

export async function getGrabStatus(): Promise<GrabStatus> {
  const cfg = getGrabConfig()
  return {
    polling: pollTimer !== null,
    lastPollTime,
    lastPollStatus,
    hasAuth: !!getActiveHeaders(),
    merchantName: connectedMerchantName ?? cfg.merchantName ?? null,
    merchantID: cachedMerchantID ?? cfg.merchantID ?? null,
    merchantGroupID: cachedMerchantGroupID ?? cfg.merchantGroupID ?? null,
    grabId: cachedGrabId ?? cfg.grabId ?? null,
    email: cachedMerchantEmail ?? cfg.email ?? null,
    role: cachedMerchantRole ?? cfg.role ?? null,
    displayRole: cachedMerchantDisplayRole ?? cfg.displayRole ?? null,
    pollIntervalMs: getPollIntervalMs(),
  }
}

// ─── Direct GrabFood order access (for POS UI) ────────────────────────────────

export async function fetchGrabOrderList(
  startDate?: string,
  endDate?: string,
  pageIndex = 0,
): Promise<{ ok: boolean; orders: GrabOrderEntry[]; hasMore: boolean; pageIndex: number; error?: string }> {
  const headers = getActiveHeaders()
  if (!headers) return { ok: false, orders: [], hasMore: false, pageIndex: 0, error: 'Phiên đăng nhập hết hạn — kết nối lại GrabFood' }

  const cleanHeaders: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    if (!k.startsWith('_')) cleanHeaders[k] = v
  }

  try {
    const url = getDailyPaginationUrl(startDate, endDate, pageIndex)
    const res = await fetch(url, { method: 'GET', headers: buildReqHeaders(cleanHeaders) })
    if (res.status === 401 || res.status === 403) return { ok: false, orders: [], hasMore: false, pageIndex: 0, error: 'Phiên đăng nhập hết hạn — kết nối lại GrabFood' }
    if (!res.ok) return { ok: false, orders: [], hasMore: false, pageIndex: 0, error: `HTTP ${res.status}` }
    const body = await res.json() as GrabOrderListResponse
    return {
      ok: true,
      orders: extractOrders(body),
      hasMore: body.hasMore ?? false,
      pageIndex: body.pageIndex ?? pageIndex,
    }
  } catch (err) {
    return { ok: false, orders: [], hasMore: false, pageIndex: 0, error: String(err) }
  }
}

export async function fetchGrabOrderDetailById(orderId: string): Promise<{ ok: boolean; order?: Record<string, unknown>; error?: string }> {
  const detail = await fetchOrderDetail(orderId)
  if (!detail) return { ok: false, error: 'Không lấy được chi tiết đơn' }
  return { ok: true, order: detail }
}

// ─── Grab live orders (orders-pagination v4) ─────────────────────────────────

async function fetchLiveOrdersCore(pageType: string): Promise<{
  ok: boolean
  orders: GrabPreparingOrder[]
  merchantID?: string
  error?: string
}> {
  const headers = getActiveHeaders()
  if (!headers) return { ok: false, orders: [], error: 'Phiên đăng nhập hết hạn — kết nối lại GrabFood' }

  const merchantID = cachedMerchantID ?? getGrabConfig().merchantID
  if (!merchantID) return { ok: false, orders: [], error: 'Chưa có Merchant ID — vui lòng sync lại phiên đăng nhập GrabFood' }

  const cleanHeaders: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    if (!k.startsWith('_')) cleanHeaders[k] = v
  }

  try {
    const url = getOrdersPaginationUrl(merchantID, pageType)
    const res = await fetch(url, { method: 'GET', headers: buildReqHeaders(cleanHeaders) })
    if (res.status === 401 || res.status === 403) return { ok: false, orders: [], error: 'Phiên đăng nhập hết hạn' }
    if (!res.ok) return { ok: false, orders: [], error: `HTTP ${res.status}` }
    const body = await res.json() as GrabPreparingOrdersResponse
    return { ok: true, orders: body.orders ?? [], merchantID }
  } catch (err) {
    return { ok: false, orders: [], error: String(err) }
  }
}

export async function fetchGrabPreparingOrderList(): Promise<{
  ok: boolean; orders: GrabPreparingOrder[]; merchantID?: string; error?: string
}> {
  return fetchLiveOrdersCore('PreparingV2')
}

export async function fetchGrabLiveOrders(pageType: string): Promise<{
  ok: boolean; orders: GrabPreparingOrder[]; merchantID?: string; error?: string
}> {
  return fetchLiveOrdersCore(pageType)
}

export async function markGrabOrderReady(
  orderID: string,
  preparationTaskID?: string,
): Promise<{ ok: boolean; error?: string }> {
  const headers = getActiveHeaders()
  if (!headers) return { ok: false, error: 'Chưa kết nối GrabFood' }

  const cleanHeaders: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    if (!k.startsWith('_')) cleanHeaders[k] = v
  }

  const body: Record<string, unknown> = {
    orderIDs: [orderID],
    markStatus: 1,
  }
  if (preparationTaskID) body.preparationTaskIDs = [preparationTaskID]

  try {
    const res = await fetch(`${GRAB_API_BASE}/food/merchant/orders/mark`, {
      method: 'POST',
      headers: { ...buildReqHeaders(cleanHeaders), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn('[GrabFood] markReady error:', res.status, text.slice(0, 200))
      return { ok: false, error: `HTTP ${res.status}` }
    }
    console.log('[GrabFood] markReady OK:', orderID)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// ─── Grab revenue summary ─────────────────────────────────────────────────────

interface GrabRevenueSummaryResponse {
  currency?: { code: string }
  totalEarningsInMinorUnit?: number
  totalEarningDisplay?: string
  revenueInMinorUnit?: number
  revenueDisplay?: string
  completedOrders?: number
  cancelledOrders?: number
}

export async function fetchGrabRevenueSummary(date: string): Promise<{
  ok: boolean
  data?: GrabRevenueSummaryResponse
  error?: string
}> {
  const headers = getActiveHeaders()
  if (!headers) return { ok: false, error: 'Chưa kết nối GrabFood' }

  const cleanHeaders: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    if (!k.startsWith('_')) cleanHeaders[k] = v
  }

  try {
    const url = `${GRAB_API_BASE}/food/merchant/v1/merchant-report-summary?startDate=${date}`
    const res = await fetch(url, { method: 'GET', headers: buildReqHeaders(cleanHeaders) })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const data = await res.json() as GrabRevenueSummaryResponse
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

export async function syncGrabRevenueSummary(date: string): Promise<{
  ok: boolean
  data?: GrabRevenueSummaryResponse
  error?: string
}> {
  const result = await fetchGrabRevenueSummary(date)
  if (!result.ok || !result.data) return result

  const d = result.data
  const apiUrl = _savedIngestUrl
    ? _savedIngestUrl.replace('/ingest', '/grab-revenue')
    : `${process.env['VITE_API_URL'] || 'http://localhost:5000'}/admin/external/grab-revenue`
  const key = _savedInternalKey || process.env['VITE_INTERNAL_ANALY_KEY'] || ''

  try {
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'x-internal-key': key } : {}),
      },
      body: JSON.stringify({
        platform: 'grab',
        date,
        totalEarnings: d.totalEarningsInMinorUnit ?? 0,
        revenue: d.revenueInMinorUnit ?? 0,
        completedOrders: d.completedOrders ?? 0,
        cancelledOrders: d.cancelledOrders ?? 0,
        rawJson: d,
      }),
    })
    if (!resp.ok) return { ok: false, error: `Backend HTTP ${resp.status}` }
    return { ok: true, data: d }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// ─── Daily end-of-day auto-sync ───────────────────────────────────────────────

let dailySyncTimer: ReturnType<typeof setInterval> | null = null
let lastDailySyncDate: string | null = null

function getVnDateStr(): string {
  const ms = Date.now() + 7 * 60 * 60 * 1000
  return new Date(ms).toISOString().slice(0, 10)
}

function getVnHour(): number {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).getUTCHours()
}

function getVnMinute(): number {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).getUTCMinutes()
}

async function checkDailySync() {
  const hour = getVnHour()
  const min = getVnMinute()
  // Sync at 23:50–23:59 VN time
  if (hour !== 23 || min < 50) return
  const today = getVnDateStr()
  if (lastDailySyncDate === today) return
  if (!getActiveHeaders()) return
  console.log('[GrabFood] Daily auto-sync revenue for', today)
  const result = await syncGrabRevenueSummary(today)
  if (result.ok) {
    lastDailySyncDate = today
    console.log('[GrabFood] Daily revenue synced:', result.data)
  } else {
    console.warn('[GrabFood] Daily revenue sync failed:', result.error)
  }
}

export function startDailySyncQueue() {
  if (dailySyncTimer) return
  // Check every 10 minutes
  dailySyncTimer = setInterval(() => void checkDailySync(), 10 * 60 * 1000)
  console.log('[GrabFood] Daily sync queue started')
}

export function stopDailySyncQueue() {
  if (dailySyncTimer) {
    clearInterval(dailySyncTimer)
    dailySyncTimer = null
  }
}
