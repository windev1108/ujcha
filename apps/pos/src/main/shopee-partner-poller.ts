//shopee-partner-poller.ts
import { BrowserWindow, net, session } from 'electron'
import { readSubConfig, writeSubConfig } from '../renderer/src/store/config-store'

const SPF_API = 'https://gmerchant.deliverynow.vn'
const PARTNER_API = 'https://api.partner.shopee.vn'
const SPF_ORIGIN = 'https://partner.shopee.vn'
const SPF_ORDER_LIST_PAGE = 'https://partner.shopee.vn/shopee-food/order-management'
const DEFAULT_POLL_INTERVAL_MS = 30_000

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SpfTransaction {
  status: number
  amount: string
  create_time: string
  order_code: string
  order_id: number
  type: number
  transaction_id: string
}

interface SpfOrder {
  order_code?: string
  code?: string
  order_id?: number | string
  id?: number | string
  status?: number
}

export interface SpfPartnerStatus {
  connected: boolean
  polling: boolean
  restaurantId: string | null
  restaurantName: string | null
  entityId: string | null
  savedAt: string | null
  pollIntervalMs: number
  // health
  lastPollOk: boolean
  lastPollError: string | null
  lastSuccessfulPollAt: string | null
  consecutiveFailures: number
  needsReauth: boolean
}

// ─── Config ───────────────────────────────────────────────────────────────────

interface SpfPartnerConfig {
  headersMap?: Record<string, string>
  restaurantId?: string
  restaurantName?: string
  entityId?: string
  savedAt?: string
  pollIntervalMs?: number
}

// ─── Order types (get_list_with_pagination) ───────────────────────────────────

export interface SpfDish {
  id: number
  name: string
  image?: string
  mms_image?: string
  original_price: number
  discount_price: number
  has_promotion?: boolean
  description?: string
}

export interface SpfOrderItemOption {
  id: number
  name: string
  original_price: number
  discount_price: number
  quantity: number
}

export interface SpfOrderItemOptionGroup {
  id: number
  name: string
  options: SpfOrderItemOption[]
}

export interface SpfOrderItem {
  id: number
  dish: SpfDish
  quantity: number
  original_price: number
  discount_price: number
  has_promotion: boolean
  is_free_item: boolean
  note?: string
  options_groups: SpfOrderItemOptionGroup[]
}

export interface SpfCustomerBill {
  sub_total: number
  total_amount: number
  total_discount: number
  shipping_fee: number
  packing_fee: number
  parking_fee: number
  surcharge_fee: number
  hand_deliver_fee: number
  item_discount: number
  small_order_fee: number
  service_fee: number
  merchant_discount: number
  bad_weather_fee: number
}

export interface SpfDeliverAddress {
  contact_name: string
  address: string
}

export interface SpfPerson {
  id?: number
  name: string
  avatar_url?: string
  is_deleted?: boolean
}

export interface SpfCancelInfo {
  allow_cancel: boolean
  type?: number
  reason?: string
  reason_id?: number[]
  time?: number
}

export interface SpfOrderFull {
  code: string
  id: number
  restaurant_id: number
  restaurant_name: string
  store_id: number
  order_status: number
  order_time: number
  merchant_confirm_time?: number
  pick_time?: number
  deliver_time?: number
  actual_pick_time?: number
  actual_deliver_time?: number
  prepare_time: number
  actual_prepare_time?: number
  order_user: SpfPerson & { latest_rating?: number }
  assignee?: SpfPerson
  deliver_address: SpfDeliverAddress
  customer_bill: SpfCustomerBill
  order_items: SpfOrderItem[]
  total_dish: number
  order_value_amount: number
  total_value_amount: number
  commission?: { amount: number; value: number }
  cancel_info?: SpfCancelInfo
  bad_order_note_content?: string | null
  shipping_info?: { distance: number; method: number }
  is_asap?: boolean
  is_done?: boolean
  notes?: Record<string, unknown>
  serial?: string
  [key: string]: unknown
}

interface SpfOrderListResponse {
  msg?: string
  code: number
  data?: {
    total_count: number
    result_count: number
    orders: SpfOrderFull[]
  }
}

// Cache of most-recently-fetched orders, keyed by order code — lets the detail
// modal open instantly from data we already have instead of an extra request.
const _lastOrdersCache = new Map<string, SpfOrderFull>()
let _lastRequestRange: { from_time: number; to_time: number } | null = null
let _lastRequestPageNum: number | null = null
let _lastTotalCount = 0
let _lastPageSize = 10


const _rangeCache = new Map<string, { orders: SpfOrderFull[]; at: number }>()
const RANGE_CACHE_TTL_MS = 8_000

// Thêm sau RANGE_CACHE_TTL_MS
const DEFAULT_RANGE_DAYS = 30
const DEFAULT_RANGE_CACHE_TTL_MS = 60_000  // cache "toàn bộ default range" — tránh spam portal khi nhiều lời gọi liên tiếp

let _defaultRangeOrders: SpfOrderFull[] = []
let _defaultRangeFetchedAt = 0
let _defaultRangeFetching: Promise<void> | null = null

function isWithinDefaultWindow(fromTs: number): boolean {
  const cutoffTs = Math.floor((Date.now() - DEFAULT_RANGE_DAYS * 86_400_000) / 1000)
  return fromTs >= cutoffTs
}

// Lấy default range (portal tự set sẵn ~30 ngày) — KHÔNG set date picker,
// KHÔNG có expected range nên không bao giờ bị "KHÔNG khớp" / retry.
async function refreshDefaultRangeCache(force = false): Promise<void> {
  if (!force && Date.now() - _defaultRangeFetchedAt < DEFAULT_RANGE_CACHE_TTL_MS) return
  if (_defaultRangeFetching) return _defaultRangeFetching

  _defaultRangeFetching = (async () => {
    // Chủ động truyền range 30 ngày thật sự — để triggerPortalOrderFetch dùng
    // đúng shortcut "30 ngày qua" (qua matchShortcutLabel) thay vì phó mặc
    // cho bất kỳ range nào portal đang giữ sẵn.
    const toDate = vnDateStr(0)
    const fromDate = vnDateStr(29)
    await withPortalLock(() => triggerPortalOrderFetch(fromDate, toDate))
    if (_lastInterceptedOrderList) {
      _defaultRangeOrders = _lastInterceptedOrderList
      _defaultRangeFetchedAt = Date.now()
      console.log(`[ShopeePartner] Default-range cache refreshed — ${_defaultRangeOrders.length} orders`)
    }
  })()

  try {
    await _defaultRangeFetching
  } finally {
    _defaultRangeFetching = null
  }
}

function rangeCacheKey(fromDate: string, toDate: string): string {
  return `${fromDate}|${toDate}`
}

export async function fetchSpfOrderDetailByCode(
  code: string,
): Promise<{ ok: boolean; order?: SpfOrderFull; error?: string }> {
  const cached = _lastOrdersCache.get(code)
  if (cached) return { ok: true, order: cached }

  const today = (() => {
    const ms = Date.now() + 7 * 60 * 60 * 1000
    return new Date(ms).toISOString().slice(0, 10)
  })()
  const result = await fetchSpfOrderList(today, today)
  const found = result.orders.find(o => o.code === code)
  if (found) return { ok: true, order: found }
  return { ok: false, error: 'Không tìm thấy chi tiết đơn — đơn có thể nằm ngoài khoảng ngày hôm nay' }
}

function getConfig(): SpfPartnerConfig {
  return (readSubConfig('spfPartnerSetting') as SpfPartnerConfig | null) ?? {}
}

function saveConfig(patch: Partial<SpfPartnerConfig>) {
  writeSubConfig('spfPartnerSetting', { ...getConfig(), ...patch })
}

// ─── Runtime state ────────────────────────────────────────────────────────────

let cachedHeaders: Record<string, string> | null = null
let cachedRestaurantId: string | null = null
let cachedRestaurantName: string | null = null
let cachedEntityId: string | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let lastKnownOrderCodes = new Set<string>()
let seeded = false  // true after first poll seeds baseline; only notify on subsequent polls
let _onNewOrderCb: ((orderCode: string) => void) | null = null
let _pollerWin: BrowserWindow | null = null
let _pollerReady: Promise<void> | null = null

// Đơn hàng lấy được từ chính request thật do portal tự phát ra (KHÔNG phải fetch giả).
// Được set trong Network.responseReceived handler của initPollerWin().
let _lastInterceptedOrderList: SpfOrderFull[] | null = null
let _lastInterceptedAt = 0

// ─── Health tracking ──────────────────────────────────────────────────────────
let _consecutiveFailures = 0
let _lastPollOk = true
let _lastPollError: string | null = null
let _lastSuccessfulPollAt: number | null = null
let _lastPortalReloadMs = 0
const PORTAL_REFRESH_INTERVAL_MS = 20 * 60 * 1000 // reload portal mỗi 20 phút để làm mới session
const MAX_CONSECUTIVE_FAILURES_BEFORE_REAUTH_FLAG = 5

function markPollResult(ok: boolean, error?: string) {
  _lastPollOk = ok
  _lastPollError = ok ? null : (error ?? 'unknown error')
  if (ok) {
    _consecutiveFailures = 0
    _lastSuccessfulPollAt = Date.now()
  } else {
    _consecutiveFailures++
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      console.warn(`[ShopeePartner] ${label} timed out after ${ms}ms — bỏ qua để giải phóng hàng đợi`)
      resolve(null)
    }, ms)
    promise.then(
      (v) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v) } },
      (e) => { if (!settled) { settled = true; clearTimeout(timer); console.warn(`[ShopeePartner] ${label} rejected:`, e); resolve(null) } },
    )
  })
}

// Khi 1 thao tác bị treo thật sự (timeout), cửa sổ portal có thể đang ở trạng
// thái dở dang (đang giữa lúc click/loadURL) — an toàn nhất là huỷ và dựng lại
// window mới hoàn toàn, tránh 2 thao tác tranh chấp trên cùng 1 window sau này.
async function forceRecreatePollerWin(): Promise<void> {
  console.warn('[ShopeePartner] Force recreating poller window do thao tác bị treo')
  try { _pollerWin?.destroy() } catch { /* ignore */ }
  _pollerWin = null
  _pollerReady = null
  await initPollerWin()
}

export function setOnNewSpfOrderCallback(cb: (orderCode: string) => void) {
  _onNewOrderCb = cb
}

function getActiveHeaders(): Record<string, string> | null {
  if (cachedHeaders && Object.keys(cachedHeaders).length > 0) return cachedHeaders
  const saved = getConfig().headersMap
  if (saved && Object.keys(saved).length > 0) {
    cachedHeaders = saved
    return cachedHeaders
  }
  return null
}

function buildHeaders(): Record<string, string> {
  const base = getActiveHeaders() ?? {}
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(base)) {
    if (!k.startsWith('_')) clean[k] = v
  }
  return {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'vi-VN,vi;q=0.9',
    origin: SPF_ORIGIN,
    referer: `${SPF_ORIGIN}/`,
    'x-foody-api-version': '1',
    'x-foody-app-type': '1025',
    'x-foody-client-language': 'en',
    'x-foody-client-type': '1',
    'x-foody-client-version': '3.0.0',
    ...clean,
  }
}

function getPollIntervalMs(): number {
  const saved = getConfig().pollIntervalMs
  if (saved && saved >= 5000 && saved <= 60000) return saved
  return DEFAULT_POLL_INTERVAL_MS
}

function getRestaurantId(): string | null {
  return cachedRestaurantId ?? getConfig().restaurantId
    ?? cachedEntityId ?? getConfig().entityId ?? null
}

// ─── Portal window ─────────────────────────────────────────────────────────
// Portal tự gọi get_list_with_pagination bằng chữ ký thật của nó khi ta điều
// hướng tới trang order/list — y hệt như khi người dùng tự bấm vào tab lịch
// sử đơn hàng. Ta KHÔNG tự soạn fetch() (luôn bị CORS chặn), chỉ đọc lại
// response thật đó qua CDP. Cửa sổ này CHÍNH LÀ cửa sổ người dùng dùng để
// đăng nhập (webLogin trong main.ts) — không tạo cửa sổ ẩn riêng nữa, để
// tránh phải đăng nhập lại / capture header hai lần.

async function clickPaginationNav(win: BrowserWindow, direction: 'prev' | 'next'): Promise<boolean> {
  const cls = direction === 'prev' ? 'shopee-food-pagination-prev' : 'shopee-food-pagination-next'
  const rectJs = `(function(){
    var li = document.querySelector('.${cls}');
    if (!li) return null;
    if (li.getAttribute('aria-disabled') === 'true') return { disabled: true };
    var btn = li.querySelector('button, a') || li;
    var r = btn.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`
  let result: { x?: number; y?: number; disabled?: boolean } | null = null
  try {
    result = await win.webContents.executeJavaScript(rectJs)
  } catch { return false }
  if (!result || result.disabled) return false

  const wc = win.webContents
  wc.sendInputEvent({ type: 'mouseMove', x: result.x!, y: result.y! })
  await new Promise(r => setTimeout(r, 40))
  wc.sendInputEvent({ type: 'mouseDown', x: result.x!, y: result.y!, button: 'left', clickCount: 1 })
  await new Promise(r => setTimeout(r, 40))
  wc.sendInputEvent({ type: 'mouseUp', x: result.x!, y: result.y!, button: 'left', clickCount: 1 })
  return true
}

// Đổi số dòng/trang bằng cách click nút "Số dòng: 10/20/30/40/50"
async function clickPageSizeOption(win: BrowserWindow, pageSize: number): Promise<boolean> {
  const rectJs = `(function(){
    var btns = document.querySelectorAll('.shopee-food-pagination-total-text button.shopee-food-btn-link');
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].textContent.trim() === '${pageSize}') {
        var r = btns[i].getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }
    }
    return null;
  })()`
  let rect: { x: number; y: number } | null = null
  try {
    rect = await win.webContents.executeJavaScript(rectJs)
  } catch { return false }
  if (!rect) return false

  const wc = win.webContents
  wc.sendInputEvent({ type: 'mouseMove', x: rect.x, y: rect.y })
  await new Promise(r => setTimeout(r, 40))
  wc.sendInputEvent({ type: 'mouseDown', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
  await new Promise(r => setTimeout(r, 40))
  wc.sendInputEvent({ type: 'mouseUp', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
  return true
}

async function navigateToPage(win: BrowserWindow, targetPage: number): Promise<boolean> {
  const MAX_STEPS = 50 // an toàn, ứng với tối đa 50 trang từ vị trí hiện tại
  for (let i = 0; i < MAX_STEPS; i++) {
    if (_lastRequestPageNum === targetPage) return true
    const direction: 'prev' | 'next' = (_lastRequestPageNum ?? 1) < targetPage ? 'next' : 'prev'
    const before = _lastInterceptedAt
    const clicked = await clickPaginationNav(win, direction)
    if (!clicked) return _lastRequestPageNum === targetPage

    const deadline = Date.now() + 8000
    while (Date.now() < deadline) {
      if (_lastInterceptedAt > before) break
      await new Promise(r => setTimeout(r, 200))
    }
    if (_lastInterceptedAt <= before) return false // click không trigger được request mới
  }
  return _lastRequestPageNum === targetPage
}

export async function fetchSpfOrderListPage(
  fromDate: string,
  toDate: string,
  pageNum: number,
  pageSize: number,
): Promise<{ ok: boolean; orders: SpfOrderFull[]; totalCount: number; pageSize: number; pageNum: number; error?: string }> {
  const headers = getActiveHeaders()
  if (!headers) return { ok: false, orders: [], totalCount: 0, pageSize, pageNum, error: 'Chưa kết nối ShopeeFood Partner' }
  const restaurantId = getRestaurantId()
  if (!restaurantId) return { ok: false, orders: [], totalCount: 0, pageSize, pageNum, error: 'Chưa có Restaurant ID' }
  if (!_pollerWin || _pollerWin.isDestroyed()) {
    return { ok: false, orders: [], totalCount: 0, pageSize, pageNum, error: 'Cửa sổ portal chưa sẵn sàng' }
  }

  return withPortalLock(async () => {
    // Bước 1: đưa portal về đúng range ngày + trang 1 (dùng lại triggerPortalOrderFetch)
    _lastRequestPageNum = null
    await triggerPortalOrderFetch(fromDate, toDate)

    // Bước 2: nếu page_size portal đang khác mong muốn, đổi nó
    if (_lastPageSize !== pageSize) {
      const before = _lastInterceptedAt
      const changed = await clickPageSizeOption(_pollerWin!, pageSize)
      if (changed) {
        const deadline = Date.now() + 8000
        while (Date.now() < deadline) {
          if (_lastInterceptedAt > before) break
          await new Promise(r => setTimeout(r, 200))
        }
      }
    }

    // Bước 3: điều hướng tới đúng trang
    if (pageNum > 1) {
      const ok = await navigateToPage(_pollerWin!, pageNum)
      if (!ok) {
        return {
          ok: false, orders: [], totalCount: _lastTotalCount, pageSize, pageNum,
          error: 'Không điều hướng được tới trang yêu cầu',
        }
      }
    }

    if (!_lastInterceptedOrderList) {
      return { ok: false, orders: [], totalCount: 0, pageSize, pageNum, error: 'Portal không trả về dữ liệu' }
    }

    return {
      ok: true,
      orders: _lastInterceptedOrderList,
      totalCount: _lastTotalCount,
      pageSize: _lastPageSize,
      pageNum: _lastRequestPageNum ?? pageNum,
    }
  })
}

function attachCdpInterceptor(win: BrowserWindow) {

  try {
    if (!win.webContents.debugger.isAttached()) {
      win.webContents.debugger.attach('1.3')
    }
    void win.webContents.debugger.sendCommand('Network.enable', {
      maxTotalBufferSize: 200_000_000,      // 200MB tổng
      maxResourceBufferSize: 100_000_000,   // 100MB mỗi resource
      maxPostDataSize: 50_000_000,
    })

    void win.webContents.debugger.sendCommand('Page.enable')
    // Bỏ patch MIN_PAGE_SIZE — giờ tôn trọng page_size mặc định của portal (10),
    // và điều khiển phân trang bằng click Prev/Next thật thay vì lấy 1 lần lớn.
    void win.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
      source: `(function(){ /* không patch page_size nữa — để trống hoặc xoá script này */ })();`,
    })

    win.webContents.debugger.removeAllListeners('message')

    // Theo dõi requestId của request order-list đang chờ loadingFinished,
    // vì gọi getResponseBody ngay lúc responseReceived hay bị lỗi/treo do
    // response chưa tải xong hoàn toàn (race condition phổ biến của CDP).
    let pendingOrderListRequestId: string | null = null

    win.webContents.debugger.on('message', async (_, method, params) => {
      if (method === 'Network.requestWillBeSent') {
        const p = params as {
          requestId?: string
          request?: { url?: string; method?: string; postData?: string }
        }
        const url = p.request?.url ?? ''
        if (url.includes('gmerchant.deliverynow.vn') || url.includes('api.partner.shopee.vn')) {
          console.log('[ShopeePartner] Portal→API:', p.request?.method, url.replace(/\?.*/, ''))
        }

        // Log payload gửi đi cho request order-list, kể cả khi postData
        // không kèm sẵn trong sự kiện (một số trường hợp CDP không đính kèm
        // postData trực tiếp, phải gọi getRequestPostData riêng).
        if (url.includes('get_list_with_pagination')) {
          let postDataStr: string | undefined = p.request?.postData
          if (!postDataStr && p.requestId) {
            try {
              const pd = await win.webContents.debugger.sendCommand(
                'Network.getRequestPostData', { requestId: p.requestId },
              ) as { postData?: string }
              postDataStr = pd.postData
            } catch (e) {
              console.warn('[ShopeePartner] Could not get request post data:', e)
            }
          }
          if (postDataStr) {
            console.log('[ShopeePartner] order-list REQUEST BODY:', postDataStr)
            try {
              const parsed = JSON.parse(postDataStr) as { from_time?: number; to_time?: number; page_num?: number; page_size?: number }
              if (typeof parsed.from_time === 'number' && typeof parsed.to_time === 'number') {
                _lastRequestRange = { from_time: parsed.from_time, to_time: parsed.to_time }
              }
              if (typeof parsed.page_num === 'number') _lastRequestPageNum = parsed.page_num
              if (typeof parsed.page_size === 'number') _lastPageSize = parsed.page_size
            } catch { /* ignore parse error */ }
          }
        }
        return
      }

      if (method === 'Network.responseReceived') {
        const p = params as { requestId?: string; response?: { url?: string; status?: number; statusText?: string } }
        const url = p.response?.url ?? ''
        if (!url.includes('get_list_with_pagination')) return
        console.log('[ShopeePartner] order-list responseReceived, status:', p.response?.status, p.response?.statusText, '| requestId:', p.requestId)
        if (p.requestId) {
          pendingOrderListRequestId = p.requestId
        }
        return
      }

      if (method === 'Network.loadingFinished') {
        const p = params as { requestId?: string }
        if (!p.requestId || p.requestId !== pendingOrderListRequestId) return
        const requestId = p.requestId
        pendingOrderListRequestId = null

        try {
          const result = await win.webContents.debugger.sendCommand(
            'Network.getResponseBody', { requestId },
          )
          const raw = (result as { body: string; base64Encoded?: boolean }).body
          console.log('[ShopeePartner] order-list RAW RESPONSE:', raw.slice(0, 2000))
          const body = JSON.parse(raw) as SpfOrderListResponse
          console.log('[ShopeePartner] Parsed — code:', body.code, 'msg:', body.msg,
            '| orders:', body.data?.orders?.length ?? 0)
          if (body.code === 0 && body.data?.orders) {
            _lastInterceptedOrderList = body.data.orders
            _lastInterceptedAt = Date.now()
            _lastTotalCount = body.data.total_count
            for (const o of body.data.orders) _lastOrdersCache.set(o.code, o)
          }
        } catch (e) {
          console.warn('[ShopeePartner] Could not read order-list response body:', e)
        }
      }

      if (method === 'Network.loadingFailed') {
        const p = params as { requestId?: string; errorText?: string; blockedReason?: string }
        if (p.requestId === pendingOrderListRequestId) {
          console.warn('[ShopeePartner] order-list loadingFailed:', p.errorText, p.blockedReason)
          pendingOrderListRequestId = null
        }
      }
    })
  } catch (e) {
    console.warn('[ShopeePartner] CDP attach failed:', e)
  }
}

// Dùng khi tự tạo window mới (ví dụ sau khi app khởi động lại và có sẵn session cũ).
function initPollerWin(): Promise<void> {
  if (_pollerWin && !_pollerWin.isDestroyed()) return _pollerReady ?? Promise.resolve()

  _pollerWin = new BrowserWindow({
    x: -3000,
    y: -3000,
    width: 1100,
    height: 760,
    show: true,
    skipTaskbar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, partition: 'persist:spf-partner' },
  })
  _pollerWin.webContents.setBackgroundThrottling(false)
  attachCdpInterceptor(_pollerWin)

  _pollerWin.on('closed', () => {
    if (_pollerWin) { _pollerWin = null; _pollerReady = null }
  })

  _pollerReady = new Promise<void>((resolve) => {
    _pollerWin!.webContents.once('did-finish-load', () => resolve())
    setTimeout(resolve, 15_000)
  })

  void _pollerWin.loadURL(SPF_ORIGIN)
  return _pollerReady
}

// Dùng ngay sau khi người dùng đăng nhập xong trong cửa sổ webLogin (main.ts) —
// biến chính cửa sổ đó thành cửa sổ polling, không tạo cửa sổ mới, không đóng
// cửa sổ đang có session/cookie thật.
export function adoptPollerWindow(win: BrowserWindow): void {
  if (_pollerWin && !_pollerWin.isDestroyed() && _pollerWin !== win) {
    _pollerWin.destroy()
  }
  _pollerWin = win
  _pollerWin.webContents.setBackgroundThrottling(false)
  if (!_pollerWin.isVisible()) _pollerWin.showInactive()
  _pollerWin.setPosition(-3000, -3000)
  _pollerWin.setSkipTaskbar(true)
  attachCdpInterceptor(_pollerWin)
  _pollerWin.on('closed', () => {
    if (_pollerWin === win) { _pollerWin = null; _pollerReady = null }
  })
  _pollerReady = Promise.resolve()
  console.log('[ShopeePartner] Adopted login window as poller window')
}

// Cửa sổ portal có thể bị đóng ngoài ý muốn (người dùng bấm X, crash, v.v.)
// → tự phát hiện và dựng lại cửa sổ ẩn mới, nếu không polling sẽ "chết lặng".
async function ensurePollerWinAlive(): Promise<void> {
  if (_pollerWin && !_pollerWin.isDestroyed()) return
  console.warn('[ShopeePartner] Poller window missing — recreating')
  _pollerWin = null
  _pollerReady = null
  await initPollerWin()
  await new Promise(r => setTimeout(r, 2000))
}

// Làm mới phiên portal định kỳ — giống việc người dùng tự F5 trang sau một
// khoảng thời gian dài, để tránh session tự hết hạn phía Shopee.
async function maybeRefreshPortal(): Promise<void> {
  if (!_pollerWin || _pollerWin.isDestroyed()) return
  const now = Date.now()
  if (now - _lastPortalReloadMs < PORTAL_REFRESH_INTERVAL_MS) return
  _lastPortalReloadMs = now
  try {
    console.log('[ShopeePartner] Refreshing portal session (periodic reload)')
    await _pollerWin.loadURL(SPF_ORDER_LIST_PAGE)
    await new Promise(r => setTimeout(r, 3000))
  } catch (e) {
    console.warn('[ShopeePartner] Portal refresh failed:', e)
  }
}

// Điều hướng lại trang order/list để CHÍNH PORTAL tự gọi API của nó — nhưng
// trang này chỉ gọi get_list_with_pagination khi người dùng bấm nút "Áp dụng"
// (filter submit), không tự gọi khi vừa load xong. Nên sau khi điều hướng,
// ta tự tìm và click nút đó trong DOM — vẫn là hành động click thật trong
// ngữ cảnh trang, không phải tự soạn request.
async function clickApplyFilterButton(): Promise<boolean> {
  if (!_pollerWin || _pollerWin.isDestroyed()) return false

  // Lấy toạ độ thật của nút trong viewport
  const rectJs = `(function(){
    var btn = document.querySelector('button.shopee-food-btn.shopee-food-btn-primary[type="submit"]');
    if (!btn) return null;
    var r = btn.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`

  let rect: { x: number; y: number } | null = null
  try {
    rect = await _pollerWin.webContents.executeJavaScript(rectJs)
  } catch (e) {
    console.warn('[ShopeePartner] getBoundingClientRect failed:', e)
    return false
  }
  if (!rect) {
    console.warn('[ShopeePartner] Apply button not found in DOM')
    return false
  }

  const { x, y } = rect
  const wc = _pollerWin.webContents

  // Gửi input event thật — isTrusted: true ở phía trang web
  wc.sendInputEvent({ type: 'mouseMove', x, y })
  await new Promise(r => setTimeout(r, 50))
  wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 })
  await new Promise(r => setTimeout(r, 50))
  wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 })

  console.log('[ShopeePartner] Sent real mouse click at', x, y)
  return true
}

// Click 1 dòng shortcut theo đúng text hiển thị — nhanh và đáng tin cậy hơn
// nhiều so với điều hướng + click ô lịch, dùng cho các range phổ biến.
async function clickShortcutItem(win: BrowserWindow, label: string): Promise<boolean> {
  const rectJs = `(function(){
    var items = document.querySelectorAll('.shopee-food-custom-date-panel-shortcut-item');
    for (var i = 0; i < items.length; i++) {
      var txt = items[i].querySelector('div') ? items[i].querySelector('div').textContent.trim() : items[i].textContent.trim();
      if (txt === ${JSON.stringify(label)}) {
        var r = items[i].getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }
    }
    return null;
  })()`
  let rect: { x: number; y: number } | null = null
  try {
    rect = await win.webContents.executeJavaScript(rectJs)
  } catch { return false }
  if (!rect) {
    console.warn('[ShopeePartner] Shortcut not found:', label)
    return false
  }

  const wc = win.webContents
  wc.sendInputEvent({ type: 'mouseMove', x: rect.x, y: rect.y })
  await new Promise(r => setTimeout(r, 40))
  wc.sendInputEvent({ type: 'mouseDown', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
  await new Promise(r => setTimeout(r, 40))
  wc.sendInputEvent({ type: 'mouseUp', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
  await new Promise(r => setTimeout(r, 200))
  console.log('[ShopeePartner] Clicked shortcut:', label, 'at', rect.x, rect.y)
  return true
}

// Xác định label shortcut khớp với range yêu cầu, nếu có
function matchShortcutLabel(fromDate: string, toDate: string): string | null {
  const today = vnDateStr(0)
  const yesterday = vnDateStr(1)
  const week7 = vnDateStr(6)
  const days30 = vnDateStr(29)

  if (fromDate === today && toDate === today) return 'Hôm nay'
  if (fromDate === yesterday && toDate === yesterday) return 'Hôm qua'
  if (fromDate === week7 && toDate === today) return '7 ngày qua'
  if (fromDate === days30 && toDate === today) return '30 ngày qua'
  return null
}

async function setPortalDateRange(win: BrowserWindow, fromDate: string, toDate: string): Promise<boolean> {
  // 1. Mở picker
  const openRectJs = `(function(){
    var el = document.getElementById('timePeriod');
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`
  const openRect: { x: number; y: number } | null = await win.webContents.executeJavaScript(openRectJs).catch(() => null)
  if (!openRect) { console.warn('[ShopeePartner] Không tìm thấy #timePeriod'); return false }

  const wc = win.webContents
  wc.sendInputEvent({ type: 'mouseMove', x: openRect.x, y: openRect.y })
  await new Promise(r => setTimeout(r, 40))
  wc.sendInputEvent({ type: 'mouseDown', x: openRect.x, y: openRect.y, button: 'left', clickCount: 1 })
  await new Promise(r => setTimeout(r, 40))
  wc.sendInputEvent({ type: 'mouseUp', x: openRect.x, y: openRect.y, button: 'left', clickCount: 1 })
  await new Promise(r => setTimeout(r, 400))

  const panelOpened = await win.webContents.executeJavaScript(
    `!!document.querySelector('.shopee-food-custom-date-panel')`
  ).catch(() => false)
  if (!panelOpened) { console.warn('[ShopeePartner] Popup lịch không mở'); return false }

  // ── Ưu tiên: dùng shortcut nếu range khớp preset có sẵn ──────────────────
  const shortcutLabel = matchShortcutLabel(fromDate, toDate)
  if (shortcutLabel) {
    const clicked = await clickShortcutItem(win, shortcutLabel)
    if (clicked) {
      await clickOutsidePopup(win)
      console.log('[ShopeePartner] Đã set date range qua shortcut:', shortcutLabel)
      return true
    }
    console.warn('[ShopeePartner] Click shortcut thất bại, fallback sang chọn lịch thủ công')
  }

  // ── Fallback: chọn thủ công qua calendar (giữ nguyên logic cũ) ───────────
  const fromTs = new Date(fromDate + 'T00:00:00').getTime()
  const toTs = new Date(toDate + 'T00:00:00').getTime()
  const nowTs = Date.now()

  const okFrom = await navigateAndClickDate(win, fromDate, fromTs, nowTs)
  if (!okFrom) { console.warn('[ShopeePartner] Không click được fromDate:', fromDate); return false }

  const okTo = await navigateAndClickDate(win, toDate, toTs, fromTs)
  if (!okTo) { console.warn('[ShopeePartner] Không click được toDate:', toDate); return false }

  await clickOutsidePopup(win)
  console.log('[ShopeePartner] Đã set date range qua calendar:', fromDate, '→', toDate)
  return true
}



function vnDateStr(offsetDays = 0): string {
  const ms = Date.now() + 7 * 60 * 60 * 1000 - offsetDays * 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

async function waitForSelector(win: BrowserWindow, selector: string, timeoutMs = 8000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const found = await win.webContents.executeJavaScript(
      `!!document.querySelector(${JSON.stringify(selector)})`
    ).catch(() => false)
    if (found) return true
    await new Promise(r => setTimeout(r, 200))
  }
  return false
}
const MAX_DATE_SET_RETRIES = 3
const DATE_MATCH_TOLERANCE_SEC = 3600
const ORDER_LIST_RESPONSE_TIMEOUT_MS = 25_000 // MỚI: page_size=999 trả về nhiều dữ liệu hơn nên cần chờ lâu hơn hẳn so với page_size=10 trước đây

async function triggerPortalOrderFetch(fromDate?: string, toDate?: string): Promise<void> {
  if (!_pollerWin || _pollerWin.isDestroyed()) return

  const expectedFromTs = fromDate
    ? Math.floor(new Date(fromDate + 'T00:00:00+07:00').getTime() / 1000)
    : null
  const expectedToTs = toDate
    ? Math.floor(new Date(toDate + 'T23:59:59+07:00').getTime() / 1000)
    : null

  const currentUrl = _pollerWin.webContents.getURL()
  const alreadyOnOrderPage = currentUrl.startsWith(SPF_ORDER_LIST_PAGE)

  for (let attempt = 1; attempt <= MAX_DATE_SET_RETRIES; attempt++) {
    const before = _lastInterceptedAt
    _lastRequestRange = null

    // Chỉ load lại trang nếu chưa ở đúng trang, hoặc đây là lần retry sau thất bại
    // (retry thì load lại để đảm bảo trạng thái sạch, tránh kẹt DOM cũ).
    if (!alreadyOnOrderPage || attempt > 1) {
      await _pollerWin.loadURL(SPF_ORDER_LIST_PAGE).catch((e) => {
        console.warn('[ShopeePartner] loadURL failed:', e)
      })
    }

    const ready = await waitForSelector(_pollerWin, 'button.shopee-food-btn.shopee-food-btn-primary[type="submit"]', 10000)
    if (!ready) {
      console.warn(`[ShopeePartner] Apply button never appeared (lần ${attempt})`)
      continue
    }

    if (fromDate && toDate) {
      const ok = await setPortalDateRange(_pollerWin, fromDate, toDate)
      if (!ok) console.warn(`[ShopeePartner] Set date-range thất bại (lần ${attempt})`)
    }

    for (let a = 0; a < 3; a++) {
      const clicked = await clickApplyFilterButton()
      if (clicked) break
      await new Promise(r => setTimeout(r, 500))
    }

    const deadline = Date.now() + ORDER_LIST_RESPONSE_TIMEOUT_MS
    while (Date.now() < deadline) {
      if (_lastInterceptedAt > before) break
      await new Promise(r => setTimeout(r, 300))
    }

    if (_lastInterceptedAt <= before) {
      console.warn(`[ShopeePartner] Timed out chờ response (lần ${attempt})`)
      continue
    }

    if (expectedFromTs === null || expectedToTs === null) return

    if (
      _lastRequestRange &&
      Math.abs(_lastRequestRange.from_time - expectedFromTs) <= DATE_MATCH_TOLERANCE_SEC &&
      Math.abs(_lastRequestRange.to_time - expectedToTs) <= DATE_MATCH_TOLERANCE_SEC
    ) {
      return
    }

    console.warn(`[ShopeePartner] Request range KHÔNG khớp (lần ${attempt}/${MAX_DATE_SET_RETRIES})`)
  }

  console.error('[ShopeePartner] Đã thử', MAX_DATE_SET_RETRIES, 'lần vẫn thất bại')
}
function sessionFetch(
  url: string,
  method = 'GET',
  bodyObj?: unknown,
): Promise<{ ok: boolean; status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const ses = session.fromPartition('persist:spf-partner')
    const req = net.request({ url, method, session: ses })
    const hdrs = buildHeaders()
    if (bodyObj) hdrs['content-type'] = 'application/json'
    for (const [k, v] of Object.entries(hdrs)) req.setHeader(k, v)
    req.on('response', (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(Buffer.from(c)))
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8')
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body })
      })
      res.on('error', reject)
    })
    req.on('error', reject)
    if (bodyObj) req.write(JSON.stringify(bodyObj))
    req.end()
  })
}

// ─── Order list ─────────────────────────────────────────────────────────────
// fromDate/toDate hiện không dùng để lọc trực tiếp (portal tự quyết định range
// theo tab đang mở) — giữ tham số để tương thích API cũ; lọc theo ngày nếu cần
// có thể làm ở phía renderer dựa trên order_time trả về.
// Bỏ toàn bộ triggerPortalOrderFetch() / clickApplyFilterButton() / CDP intercept
// cho luồng lấy order-list. Gọi thẳng như fetchSpfRestaurantList() đã làm thành công.
let _fetchQueue: Promise<void> = Promise.resolve()

function withPortalLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = _fetchQueue.then(fn, fn)
  _fetchQueue = run.then(() => undefined, () => undefined)
  return run
}


// Tìm nút prev/next đang HIỂN THỊ (không bị visibility:hidden) — vì layout có
// 2 cặp nút, chỉ 1 cặp active tuỳ theo panel trái/phải.
async function clickVisibleNavButton(win: BrowserWindow, direction: 'prev' | 'next'): Promise<boolean> {
  const cls = direction === 'prev' ? 'shopee-food-picker-header-prev-btn' : 'shopee-food-picker-header-next-btn'
  const rectJs = `(function(){
    var btns = document.querySelectorAll('.${cls}');
    for (var i = 0; i < btns.length; i++) {
      var style = btns[i].getAttribute('style') || '';
      if (style.indexOf('hidden') === -1) {
        var r = btns[i].getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }
    }
    return null;
  })()`
  let rect: { x: number; y: number } | null = null
  try {
    rect = await win.webContents.executeJavaScript(rectJs)
  } catch { return false }
  if (!rect) return false

  const wc = win.webContents
  wc.sendInputEvent({ type: 'mouseMove', x: rect.x, y: rect.y })
  await new Promise(r => setTimeout(r, 40))
  wc.sendInputEvent({ type: 'mouseDown', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
  await new Promise(r => setTimeout(r, 40))
  wc.sendInputEvent({ type: 'mouseUp', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
  await new Promise(r => setTimeout(r, 150))
  return true
}

// Kiểm tra cell có title=isoDate đã tồn tại trên DOM chưa (bất kể panel trái/phải)
async function isDateCellVisible(win: BrowserWindow, isoDate: string): Promise<boolean> {
  const js = `!!document.querySelector('td[title="${isoDate}"]')`
  try {
    return await win.webContents.executeJavaScript(js)
  } catch { return false }
}

// Click vào cell theo title — click vào .shopee-food-picker-cell-inner bên trong td
async function clickDateCellByTitle(win: BrowserWindow, isoDate: string, preferRightPanel = false): Promise<boolean> {
  const rectJs = `(function(){
    var tds = document.querySelectorAll('td[title="${isoDate}"]');
    if (tds.length === 0) return null;
    var target = tds[0];
    if (${preferRightPanel} && tds.length > 1) {
      // Panel phải là panel thứ 2 trong .shopee-food-picker-panels
      var panels = document.querySelectorAll('.shopee-food-picker-panel');
      for (var i = 0; i < tds.length; i++) {
        if (panels[1] && panels[1].contains(tds[i])) { target = tds[i]; break; }
      }
    }
    var inner = target.querySelector('.shopee-food-picker-cell-inner') || target;
    var r = inner.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`
  let rect: { x: number; y: number } | null = null
  try {
    rect = await win.webContents.executeJavaScript(rectJs)
  } catch { return false }
  if (!rect) return false

  const wc = win.webContents
  wc.sendInputEvent({ type: 'mouseMove', x: rect.x, y: rect.y })
  await new Promise(r => setTimeout(r, 40))
  wc.sendInputEvent({ type: 'mouseDown', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
  await new Promise(r => setTimeout(r, 40))
  wc.sendInputEvent({ type: 'mouseUp', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
  await new Promise(r => setTimeout(r, 200))
  return true
}

// Điều hướng lịch (bấm prev/next liên tục) cho tới khi cell isoDate xuất hiện trên DOM,
// rồi click vào nó. Giới hạn 36 lần bấm (~3 năm) để tránh vòng lặp vô hạn nếu lệch hướng.
async function navigateAndClickDate(win: BrowserWindow, isoDate: string, targetTs: number, refTs: number): Promise<boolean> {
  if (await isDateCellVisible(win, isoDate)) {
    return clickDateCellByTitle(win, isoDate)
  }
  const direction: 'prev' | 'next' = targetTs < refTs ? 'prev' : 'next'
  for (let i = 0; i < 36; i++) {
    const moved = await clickVisibleNavButton(win, direction)
    if (!moved) break
    if (await isDateCellVisible(win, isoDate)) {
      return clickDateCellByTitle(win, isoDate)
    }
  }
  return false
}

// Click ra ngoài popup để đóng nó (không có nút confirm riêng trong panel này)
async function clickOutsidePopup(win: BrowserWindow) {
  const rectJs = `(function(){
    var label = Array.from(document.querySelectorAll('div, span')).find(
      el => el.textContent.trim() === 'Tên quán'
    );
    if (!label) return { x: 50, y: 50 };
    var r = label.getBoundingClientRect();
    return { x: r.x, y: r.y };
  })()`
  const rect: { x: number; y: number } = await win.webContents.executeJavaScript(rectJs).catch(() => ({ x: 50, y: 50 }))
  const wc = win.webContents
  wc.sendInputEvent({ type: 'mouseMove', x: rect.x, y: rect.y })
  await new Promise(r => setTimeout(r, 40))
  wc.sendInputEvent({ type: 'mouseDown', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
  await new Promise(r => setTimeout(r, 40))
  wc.sendInputEvent({ type: 'mouseUp', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
  await new Promise(r => setTimeout(r, 200))
}


export async function fetchSpfOrderList(
  fromDate: string,
  toDate: string,
): Promise<{ ok: boolean; orders: SpfOrderFull[]; totalCount: number; resultCount: number; error?: string }> {
  const headers = getActiveHeaders()
  if (!headers) return { ok: false, orders: [], totalCount: 0, resultCount: 0, error: 'Chưa kết nối ShopeeFood Partner' }

  const restaurantId = getRestaurantId()
  if (!restaurantId) return { ok: false, orders: [], totalCount: 0, resultCount: 0, error: 'Chưa có Restaurant ID' }

  if (!_pollerWin || _pollerWin.isDestroyed()) {
    return { ok: false, orders: [], totalCount: 0, resultCount: 0, error: 'Cửa sổ portal chưa sẵn sàng' }
  }

  const fromTs = Math.floor(new Date(fromDate + 'T00:00:00+07:00').getTime() / 1000)
  const toTs = Math.floor(new Date(toDate + 'T23:59:59+07:00').getTime() / 1000)

  // ─── Trong mốc 30 ngày → dùng cache default-range, filter bằng JS, KHÔNG trigger portal event ───
  if (isWithinDefaultWindow(fromTs)) {
    await refreshDefaultRangeCache()
    const orders = _defaultRangeOrders.filter(o => o.order_time >= fromTs && o.order_time <= toTs)
    return { ok: true, orders, totalCount: orders.length, resultCount: orders.length }
  }

  // ─── Ngoài mốc 30 ngày → data không có trong default cache, phải trigger filter thật trên portal ───
  const cacheKey = rangeCacheKey(fromDate, toDate)
  const cached = _rangeCache.get(cacheKey)
  if (cached && Date.now() - cached.at < RANGE_CACHE_TTL_MS) {
    return { ok: true, orders: cached.orders, totalCount: cached.orders.length, resultCount: cached.orders.length }
  }

  await withPortalLock(() => triggerPortalOrderFetch(fromDate, toDate))

  if (!_lastInterceptedOrderList) {
    return {
      ok: false, orders: [], totalCount: 0, resultCount: 0,
      error: 'Portal không trả về dữ liệu — có thể session đã hết hạn, cần đăng nhập lại',
    }
  }

  const rangeMismatch = !_lastRequestRange ||
    Math.abs(_lastRequestRange.from_time - fromTs) > DATE_MATCH_TOLERANCE_SEC ||
    Math.abs(_lastRequestRange.to_time - toTs) > DATE_MATCH_TOLERANCE_SEC

  const orders = _lastInterceptedOrderList.filter(o => o.order_time >= fromTs && o.order_time <= toTs)

  if (rangeMismatch && orders.length === 0) {
    return {
      ok: false, orders: [], totalCount: 0, resultCount: 0,
      error: 'Không set được filter ngày trên portal sau nhiều lần thử — vui lòng bấm Tải lại',
    }
  }

  _rangeCache.set(cacheKey, { orders, at: Date.now() })
  return { ok: true, orders, totalCount: orders.length, resultCount: orders.length }
}
// ─── Polling ──────────────────────────────────────────────────────────────────
let _pollBusy = false

async function runPoll() {
  if (_pollBusy) {
    console.log('[ShopeePartner] Poll tick skipped — previous poll still running')
    return
  }
  _pollBusy = true
  try {
    const headers = getActiveHeaders()
    if (!headers) return
    if (!getRestaurantId()) return

    const today = (() => {
      const ms = Date.now() + 7 * 60 * 60 * 1000
      return new Date(ms).toISOString().slice(0, 10)
    })()
    const result = await fetchSpfOrderList(today, today)

    if (!result.ok) {
      markPollResult(false, result.error)
      if (_consecutiveFailures >= MAX_CONSECUTIVE_FAILURES_BEFORE_REAUTH_FLAG) {
        console.warn('[ShopeePartner] Too many consecutive failures — likely needs re-login')
      }
      return
    }

    markPollResult(true)
    const codes = result.orders.map(o => o.code)

    if (!seeded) {
      codes.forEach(c => lastKnownOrderCodes.add(c))
      seeded = true
      console.log(`[ShopeePartner] Seeded ${lastKnownOrderCodes.size} existing order codes`)
      return
    }

    for (const code of codes) {
      if (!code || lastKnownOrderCodes.has(code)) continue
      lastKnownOrderCodes.add(code)
      console.log('[ShopeePartner] New order detected:', code)
      _onNewOrderCb?.(code)
    }
  } catch (err) {
    markPollResult(false, err instanceof Error ? err.message : String(err))
    console.error('[ShopeePartner] Poll error:', err)
  } finally {
    _pollBusy = false
  }
}

// ─── Public control ───────────────────────────────────────────────────────────

export function startSpfPartnerPolling() {
  if (pollTimer) return
  const cfg = getConfig()
  if (cfg.headersMap && Object.keys(cfg.headersMap).length > 0) cachedHeaders = cfg.headersMap
  if (cfg.restaurantId) cachedRestaurantId = cfg.restaurantId
  if (cfg.restaurantName) cachedRestaurantName = cfg.restaurantName
  if (cfg.entityId) cachedEntityId = cfg.entityId

  const hasHeaders = !!getActiveHeaders()

  if (!hasHeaders) {
    console.log('[ShopeePartner] No auth — polling disabled')
    return
  }

  if (!cachedRestaurantId) {
    console.log('[ShopeePartner] No restaurantId saved — probing partner API to migrate...')
    void fetchSpfRestaurantList().then(restaurants => {
      if (restaurants.length > 0) {
        const r = restaurants[0]
        cachedRestaurantId = String(r.restaurant_id)
        cachedRestaurantName = r.name
        saveConfig({ restaurantId: cachedRestaurantId, restaurantName: r.name })
        console.log('[ShopeePartner] Migrated restaurantId:', cachedRestaurantId)
      } else {
        console.warn('[ShopeePartner] Migration failed — still no restaurantId')
      }
      beginPolling()
    })
    return
  }

  beginPolling()
}

function beginPolling() {
  if (pollTimer) return

  void initPollerWin().then(async () => {
    if (_pollerWin && !_pollerWin.isDestroyed()) {
      console.log('[ShopeePartner] Initial portal navigation:', SPF_ORDER_LIST_PAGE)
      const result = await withTimeout(refreshDefaultRangeCache(true), 25_000, 'initial refreshDefaultRangeCache')
      if (result === null) await forceRecreatePollerWin()
      console.log('[ShopeePartner] Initial default-range orders:', _defaultRangeOrders.length)
    }
    void runPoll()
    pollTimer = setInterval(() => void runPoll(), getPollIntervalMs())
    console.log(`[ShopeePartner] Polling started, interval=${getPollIntervalMs() / 1000}s`)
  })
}
export function stopSpfPartnerPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

export function resumeSpfPartnerPolling() {
  stopSpfPartnerPolling()
  startSpfPartnerPolling()
}

export function resetSpfPartnerSession() {
  stopSpfPartnerPolling()
  cachedHeaders = null
  cachedRestaurantId = null
  cachedRestaurantName = null
  cachedEntityId = null
  lastKnownOrderCodes.clear()
  seeded = false
  _lastInterceptedOrderList = null
  _lastInterceptedAt = 0
  _rangeCache.clear()
  _defaultRangeOrders = []
  _defaultRangeFetchedAt = 0
  _consecutiveFailures = 0
  _lastPollOk = true
  _lastPollError = null
  _lastSuccessfulPollAt = null
  _lastPortalReloadMs = 0
  if (_pollerWin && !_pollerWin.isDestroyed()) { _pollerWin.destroy(); _pollerWin = null }
  _pollerReady = null
  writeSubConfig('spfPartnerSetting', {})
  console.log('[ShopeePartner] Session reset')
}

export function getSpfPartnerStatus(): SpfPartnerStatus {
  const cfg = getConfig()
  const eid = cachedEntityId ?? cfg.entityId ?? null
  const rid = cachedRestaurantId ?? cfg.restaurantId ?? null
  return {
    connected: !!getActiveHeaders() && !!(rid ?? eid),
    polling: pollTimer !== null,
    restaurantId: rid,
    restaurantName: cachedRestaurantName ?? cfg.restaurantName ?? null,
    entityId: eid,
    savedAt: cfg.savedAt ?? null,
    pollIntervalMs: getPollIntervalMs(),
    lastPollOk: _lastPollOk,
    lastPollError: _lastPollError,
    lastSuccessfulPollAt: _lastSuccessfulPollAt ? new Date(_lastSuccessfulPollAt).toISOString() : null,
    consecutiveFailures: _consecutiveFailures,
    needsReauth: _consecutiveFailures >= MAX_CONSECUTIVE_FAILURES_BEFORE_REAUTH_FLAG,
  }
}

interface SpfRestaurantInfo {
  store_id: number
  restaurant_id: number
  delivery_id: number
  name: string
  foody_service_id: number
}

export async function fetchSpfRestaurantList(): Promise<SpfRestaurantInfo[]> {
  try {
    const res = await sessionFetch(
      `${SPF_API}/api/v5/seller/store/get_basic_infos_for_partner_web`,
      'POST',
      { foody_service_id: 1, overtime_order_mode: 0 },
    )
    if (!res.ok) return []
    const body = JSON.parse(res.body) as { code: number; data?: { restaurants?: SpfRestaurantInfo[] } }
    if (body.code !== 0) return []
    return body.data?.restaurants ?? []
  } catch { return [] }
}

export async function saveSpfPartnerSession(
  headersMap: Record<string, string>,
  restaurantId?: string,
  restaurantName?: string,
): Promise<void> {
  cachedHeaders = headersMap

  const entityId = headersMap['x-foody-entity-id'] ?? headersMap['X-Foody-Entity-Id']
    ?? headersMap['x-foody-entity-mid'] ?? headersMap['X-Foody-Entity-Mid'] ?? null
  if (entityId) cachedEntityId = entityId

  if (restaurantId) cachedRestaurantId = restaurantId
  if (restaurantName) cachedRestaurantName = restaurantName

  if (!cachedRestaurantId || !cachedRestaurantName) {
    const restaurants = await fetchSpfRestaurantList()
    if (restaurants.length > 0) {
      const r = restaurants[0]
      cachedRestaurantId = String(r.restaurant_id)
      cachedRestaurantName = r.name
      console.log('[ShopeePartner] Restaurant from probe — restaurant_id:', cachedRestaurantId, 'name:', r.name)
    } else if (!cachedRestaurantId && entityId) {
      cachedRestaurantId = entityId
      console.warn('[ShopeePartner] Probe failed — using entityId as restaurantId fallback')
    }
  }

  saveConfig({
    headersMap,
    restaurantId: cachedRestaurantId ?? undefined,
    restaurantName: cachedRestaurantName ?? undefined,
    entityId: cachedEntityId ?? undefined,
    savedAt: new Date().toISOString(),
  })
  console.log('[ShopeePartner] Session saved — restaurantId:', cachedRestaurantId, 'entityId:', cachedEntityId, 'name:', cachedRestaurantName)
}

// ─── Transactions (giữ nguyên — dùng sessionFetch trên api.partner.shopee.vn, domain này có CORS) ─

export async function fetchSpfTransactions(
  _restaurantId: string,
  fromDate: string,
  toDate: string,
): Promise<{
  ok: boolean
  data?: { total_amount: { value: number; text: string; unit: string }; transactions: SpfTransaction[] }
  error?: string
}> {
  const headers = getActiveHeaders()
  if (!headers) return { ok: false, error: 'Chưa kết nối ShopeeFood Partner' }

  const startTs = Math.floor(new Date(fromDate + 'T00:00:00+07:00').getTime() / 1000)
  const endTs = Math.floor(new Date(toDate + 'T23:59:59+07:00').getTime() / 1000)
  const txnUrl = `${PARTNER_API}/nb/mss/web-api/PartnerTransactionServer/GetTransactionList`

  const paramVariants: Record<string, unknown>[] = [
    { start_time: startTs, end_time: endTs },
    { startTime: startTs, endTime: endTs },
    { from_date: fromDate, to_date: toDate },
    { fromDate, toDate },
    {},
  ]

  for (const params of paramVariants) {
    try {
      const res = await sessionFetch(txnUrl, 'POST', params)
      if (!res.ok) continue
      const body = JSON.parse(res.body) as {
        errorCode: number; errorMsg?: string
        data?: { list?: unknown[]; total?: number; total_amount?: number } | null
      }
      if (body.errorCode !== 0) continue

      const list = body.data?.list ?? []
      const transactions: SpfTransaction[] = (Array.isArray(list) ? list : []).map((item) => {
        const it = item as Record<string, unknown>
        return {
          status: Number(it.status ?? it.txnStatus ?? 1),
          amount: String(it.amount ?? it.txnAmount ?? it.total_amount ?? ''),
          create_time: String(it.create_time ?? it.createTime ?? it.created_at ?? ''),
          order_code: String(it.order_code ?? it.orderCode ?? it.order_id ?? it.orderId ?? ''),
          order_id: Number(it.order_id ?? it.orderId ?? 0),
          type: Number(it.type ?? it.txnType ?? 0),
          transaction_id: String(it.transaction_id ?? it.transactionId ?? it.txnId ?? ''),
        }
      })
      const totalValue = Number(body.data?.total_amount ?? body.data?.total ?? 0)
      return {
        ok: true,
        data: {
          total_amount: { value: totalValue, text: String(totalValue), unit: 'VND' },
          transactions,
        },
      }
    } catch { /* try next variant */ }
  }

  return {
    ok: true,
    data: { total_amount: { value: 0, text: '0', unit: 'VND' }, transactions: [] },
  }
}

export function applySpfPollInterval(ms: number) {
  const clamped = Math.min(60000, Math.max(5000, ms))
  saveConfig({ pollIntervalMs: clamped })
  resumeSpfPartnerPolling()
}