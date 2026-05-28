import { BrowserWindow, net, session } from 'electron'
import { readSubConfig, writeSubConfig } from '../renderer/src/store/config-store'

const SPF_API = 'https://gmerchant.deliverynow.vn'
const PARTNER_API = 'https://api.partner.shopee.vn'
const SPF_ORIGIN = 'https://partner.shopee.vn'
const DEFAULT_POLL_INTERVAL_MS = 15_000

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
let _lastXsap: { ri: string; sec: string; capturedAt: number } | null = null
let _workingEndpointIdx: number | null = null
let _interceptedOrders: string[] | null = null   // order codes captured via CDP or api.partner.shopee.vn
let _lastPortalNavMs = 0

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

// ─── Hidden portal window — CDP captures x-sap tokens from portal's own calls ─
// gmerchant.deliverynow.vn has no CORS headers → browser fetch always blocked.
// net.request (main process) bypasses CORS. x-sap-ri/x-sap-sec are captured via
// CDP from the hidden partner.shopee.vn window and injected into net.request.

function initPollerWin(): Promise<void> {
  if (_pollerWin && !_pollerWin.isDestroyed()) return _pollerReady ?? Promise.resolve()

  _pollerWin = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, partition: 'persist:spf-partner' },
  })
  _pollerWin.webContents.setBackgroundThrottling(false)

  try {
    _pollerWin.webContents.debugger.attach('1.3')
    void _pollerWin.webContents.debugger.sendCommand('Network.enable')
    _pollerWin.webContents.debugger.on('message', async (_, method, params) => {
      if (method === 'Network.requestWillBeSent') {
        const p = params as { request?: { url?: string; headers?: Record<string, string> } }
        const url = p.request?.url ?? ''
        if (!url.startsWith('https://')) return
        if (url.includes('gmerchant.deliverynow.vn') || url.includes('api.partner.shopee.vn')) {
          console.log('[ShopeePartner] Portal→API:', url.replace(/\?.*/, ''))
        }
        if (!url.includes('gmerchant.deliverynow.vn')) return
        const h = p.request?.headers ?? {}
        const ri = h['x-sap-ri'] ?? h['X-Sap-Ri'] ?? ''
        const sec = h['x-sap-sec'] ?? h['X-Sap-Sec'] ?? ''
        if (ri && sec) {
          _lastXsap = { ri, sec, capturedAt: Date.now() }
          console.log('[ShopeePartner] x-sap captured from portal')
        }
      }

      // Intercept ALL portal API responses for discovery + order extraction
      if (method === 'Network.responseReceived') {
        const p = params as { requestId?: string; response?: { url?: string; status?: number } }
        const url = p.response?.url ?? ''
        const isSpfDomain = url.includes('gmerchant.deliverynow.vn') || url.includes('api.partner.shopee.vn')
        if (!isSpfDomain || p.response?.status !== 200 || !p.requestId) return
        try {
          const result = await _pollerWin!.webContents.debugger.sendCommand('Network.getResponseBody', { requestId: p.requestId })
          const raw = (result as { body: string }).body
          const body = JSON.parse(raw) as { code?: number; result?: number; data?: unknown; [k: string]: unknown }
          const apiCode = body.code ?? body.result ?? -1
          console.log('[ShopeePartner] Intercepted:', url.replace(/\?.*/, ''), '→ code:', apiCode, '|', raw.slice(0, 400))
          if (apiCode === 0) {
            const codes = extractOrderCodes(body.data)
            if (codes.length > 0) {
              _interceptedOrders = codes
              console.log('[ShopeePartner] Got', codes.length, 'orders via portal interception')
            }
          }
        } catch { /* response body not available or not JSON */ }
      }
    })
  } catch (e) {
    console.warn('[ShopeePartner] CDP attach failed on poller window:', e)
  }

  _pollerReady = new Promise<void>((resolve) => {
    _pollerWin!.webContents.once('did-finish-load', () => {
      // Simulate visibility so the portal doesn't pause its own polling
      void _pollerWin!.webContents.executeJavaScript(`
        Object.defineProperty(document,'hidden',{get:()=>false});
        Object.defineProperty(document,'visibilityState',{get:()=>'visible'});
        document.dispatchEvent(new Event('visibilitychange'));
      `).catch(() => {})
      resolve()
    })
    setTimeout(resolve, 15_000)
  })

  void _pollerWin.loadURL(SPF_ORIGIN)
  return _pollerReady
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

    if (_lastXsap && Date.now() - _lastXsap.capturedAt < 60_000) {
      hdrs['x-sap-ri'] = _lastXsap.ri
      hdrs['x-sap-sec'] = _lastXsap.sec
      console.log('[ShopeePartner] x-sap age:', Math.round((Date.now() - _lastXsap.capturedAt) / 1000) + 's')
    }

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

// Runs fetch() from inside the portal window — browser handles CORS + cookies, no x-sap needed
async function probeFromPortalContext(url: string, body: Record<string, unknown>): Promise<{ status: number; data: unknown } | null> {
  if (!_pollerWin || _pollerWin.isDestroyed()) return null
  try {
    const js = `(async()=>{
      try{
        const r=await fetch(${JSON.stringify(url)},{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify(${JSON.stringify(body)})});
        const d=await r.json().catch(()=>null);
        return JSON.stringify({status:r.status,data:d});
      }catch(e){return JSON.stringify({error:String(e)});}
    })()`
    const raw = await _pollerWin.webContents.executeJavaScript(js) as string
    return JSON.parse(raw) as { status: number; data: unknown }
  } catch { return null }
}

// ─── Polling ──────────────────────────────────────────────────────────────────

function getRestaurantId(): string | null {
  return cachedRestaurantId ?? getConfig().restaurantId
    ?? cachedEntityId ?? getConfig().entityId ?? null
}

// Candidate endpoints tried in order; first code:0 response wins and is cached
const ORDER_CANDIDATES: Array<{
  label: string
  build: (rid: string, eid: string, date: string) => { url: string; method: 'GET' | 'POST'; body?: unknown }
}> = [
  {
    label: 'order/get_order_list rid POST',
    build: (rid, _, date) => ({
      url: `${SPF_API}/api/v5/seller/store/order/get_order_list`,
      method: 'POST',
      body: { restaurant_id: Number(rid), from_date: date, to_date: date, page: 1, page_size: 50 },
    }),
  },
  {
    label: 'order/get_order_list eid POST',
    build: (_, eid, date) => ({
      url: `${SPF_API}/api/v5/seller/store/order/get_order_list`,
      method: 'POST',
      body: { restaurant_id: Number(eid), from_date: date, to_date: date, page: 1, page_size: 50 },
    }),
  },
  {
    label: 'order/get_orders rid POST',
    build: (rid) => ({
      url: `${SPF_API}/api/v5/seller/store/order/get_orders`,
      method: 'POST',
      body: { restaurant_id: Number(rid), page: 1, page_size: 50 },
    }),
  },
  {
    label: 'store/get_new_order rid POST',
    build: (rid) => ({
      url: `${SPF_API}/api/v5/seller/store/order/get_new_order`,
      method: 'POST',
      body: { restaurant_id: Number(rid) },
    }),
  },
  {
    label: 'store/get_new_order eid POST',
    build: (_, eid) => ({
      url: `${SPF_API}/api/v5/seller/store/order/get_new_order`,
      method: 'POST',
      body: { restaurant_id: Number(eid) },
    }),
  },
  {
    label: 'report/get_order_revenue rid GET',
    build: (rid, _, date) => ({
      url: `${SPF_API}/api/v5/seller/store/report/get_order_revenue?from_date=${date}&restaurant_id=${rid}&to_date=${date}`,
      method: 'GET',
    }),
  },
  {
    label: 'airpay_transactions eid GET',
    build: (_, eid, date) => ({
      url: `${SPF_API}/api/v5/seller/store/report/get_airpay_transactions?from_date=${date}&restaurant_id=${eid}&to_date=${date}`,
      method: 'GET',
    }),
  },
]

function extractOrderCodes(data: unknown): string[] {
  if (!data || typeof data !== 'object') return []
  const d = data as Record<string, unknown>
  // Try common field names for the order array
  const list = (d['orders'] ?? d['order_list'] ?? d['data'] ?? d['items'] ?? []) as SpfOrder[]
  if (!Array.isArray(list)) return []
  return list.map((o: SpfOrder) => o.order_code ?? o.code ?? String(o.order_id ?? o.id ?? '')).filter(Boolean)
}

// AR category with unread items (observed: cate33=2)
const AR_CATE_ORDER = 33
let _lastArUnreadCount = -1   // -1 = first run, always probe
let _arProbeComplete = false   // true once we've found the AR list method name or exhausted all guesses

async function pollTransactions(): Promise<string[]> {
  // Step 1: GetArUnreadCount (POST — GET returns 405)
  let orderCateCount = 0
  try {
    const countRes = await sessionFetch(
      `${PARTNER_API}/nb/mss/web-api/PartnerNotiServer/GetArUnreadCount`,
      'POST', {},
    )
    if (countRes.ok) {
      const body = JSON.parse(countRes.body) as {
        errorCode: number
        data?: { unreadCountList?: Array<{ actionCate: number; unreadCount: number }> }
      }
      if (body.errorCode === 0) {
        const list = body.data?.unreadCountList ?? []
        console.log('[ShopeePartner] AR counts:', list.map(i => `cate${i.actionCate}=${i.unreadCount}`).join(' '))
        orderCateCount = list.find(i => i.actionCate === AR_CATE_ORDER)?.unreadCount ?? 0
      }
    }
  } catch (e) {
    console.warn('[ShopeePartner] GetArUnreadCount error:', e)
  }

  // Skip probing if count unchanged
  if (orderCateCount === _lastArUnreadCount && _lastArUnreadCount !== -1 && _arProbeComplete) {
    return _interceptedOrders ?? []
  }
  _lastArUnreadCount = orderCateCount

  // Step 2: try AR list method names via portal context (browser handles CORS/cookies)
  const arMethods = [
    'GetArNotificationList', 'GetArRecordList', 'GetArList', 'GetArItems',
    'GetArRecord', 'GetArNotification', 'ListAr', 'GetArActionList',
  ]
  for (const method of arMethods) {
    const url = `${PARTNER_API}/nb/mss/web-api/PartnerNotiServer/${method}`
    const r = await probeFromPortalContext(url, { actionCate: AR_CATE_ORDER, pageNum: 1, pageSize: 50 })
    if (r) {
      console.log(`[ShopeePartner] portal:${method}: HTTP ${r.status} | ${JSON.stringify(r.data).slice(0, 400)}`)
      if (r.status === 200) {
        const d = r.data as { error_code?: number; errorCode?: number; data?: unknown }
        const errCode = d?.error_code ?? d?.errorCode ?? -1
        if (errCode === 0) {
          const codes = extractOrderCodes(d?.data)
          console.log('[ShopeePartner] portal AR list from', method, '→', codes.length, 'codes')
          _interceptedOrders = codes
          _arProbeComplete = true
          return codes
        }
      }
    }
  }

  // Step 3: try GetTransactionList with date range via portal context
  const ms = Date.now() + 7 * 60 * 60 * 1000
  const today = new Date(ms).toISOString().slice(0, 10)
  const startTs = Math.floor(new Date(today + 'T00:00:00+07:00').getTime() / 1000)
  const endTs = Math.floor(new Date(today + 'T23:59:59+07:00').getTime() / 1000)
  const txnUrl = `${PARTNER_API}/nb/mss/web-api/PartnerTransactionServer/GetTransactionList`
  for (const body of [
    { start_time: startTs, end_time: endTs },
    { startTime: startTs, endTime: endTs },
    { from_date: today, to_date: today },
  ]) {
    const r = await probeFromPortalContext(txnUrl, body)
    if (r) {
      console.log(`[ShopeePartner] portal:GetTransactionList ${JSON.stringify(body)}: HTTP ${r.status} | ${JSON.stringify(r.data).slice(0, 400)}`)
      if (r.status === 200) {
        const d = r.data as { errorCode?: number; data?: unknown }
        if ((d?.errorCode ?? -1) === 0 && d?.data != null) {
          const codes = extractOrderCodes(d.data)
          if (codes.length > 0) {
            _interceptedOrders = codes
            _arProbeComplete = true
            return codes
          }
        }
      }
    }
  }

  _arProbeComplete = true
  return _interceptedOrders ?? []
}

async function runPoll() {
  const headers = getActiveHeaders()
  if (!headers) return

  if (!getRestaurantId()) return

  try {
    const codes = await pollTransactions()

    if (!seeded) {
      // First run: seed the known set so existing orders don't fire as "new"
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
    console.error('[ShopeePartner] Poll error:', err)
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

  // Polling requires entityId (store_id used in transactions endpoint)
  if (!cachedEntityId) {
    // Saved session has headers but no restaurant_id (old session before fix)
    // Migrate by probing the partner info endpoint
    console.log('[ShopeePartner] No restaurantId saved — probing partner API to migrate...')
    void fetchSpfRestaurantList().then(restaurants => {
      if (restaurants.length > 0) {
        const r = restaurants[0]
        cachedRestaurantId = String(r.restaurant_id)
        cachedRestaurantName = r.name
        saveConfig({ restaurantId: cachedRestaurantId, restaurantName: r.name })
        console.log('[ShopeePartner] Migrated restaurantId:', cachedRestaurantId)
        if (!pollTimer) {
          void initPollerWin().then(() => {
            if (_pollerWin && !_pollerWin.isDestroyed()) {
              _lastPortalNavMs = Date.now()
              _pollerWin.loadURL('https://partner.food.shopee.vn/').catch(() => {})
            }
          })
          void runPoll()
          pollTimer = setInterval(() => void runPoll(), getPollIntervalMs())
          console.log(`[ShopeePartner] Polling started after migration, interval=${getPollIntervalMs() / 1000}s`)
        }
      } else {
        console.warn('[ShopeePartner] Migration failed — still no restaurantId')
      }
    })
    return
  }

  // Start hidden portal window for CDP interception of the portal's own API calls
  void initPollerWin().then(() => {
    // Navigate to orders page immediately so the portal makes its first API calls
    if (_pollerWin && !_pollerWin.isDestroyed()) {
      _lastPortalNavMs = Date.now()
      const url = 'https://partner.food.shopee.vn/'
      console.log('[ShopeePartner] Initial portal navigation:', url)
      _pollerWin.loadURL(url).catch(() => {})
    }
  })

  void runPoll()
  pollTimer = setInterval(() => void runPoll(), getPollIntervalMs())
  console.log(`[ShopeePartner] Polling started, interval=${getPollIntervalMs() / 1000}s`)
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
  _workingEndpointIdx = null
  _interceptedOrders = null
  _lastPortalNavMs = 0
  _lastArUnreadCount = -1
  _arProbeComplete = false
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
    restaurantId: rid,                           // display: real restaurant_id
    restaurantName: cachedRestaurantName ?? cfg.restaurantName ?? null,
    entityId: eid,
    savedAt: cfg.savedAt ?? null,
    pollIntervalMs: getPollIntervalMs(),
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

  const entityId = headersMap['x-foody-entity-id'] ?? headersMap['X-Foody-Entity-Id'] ?? null
  if (entityId) cachedEntityId = entityId

  if (restaurantId) cachedRestaurantId = restaurantId
  if (restaurantName) cachedRestaurantName = restaurantName

  // If we still don't have the real restaurant_id (CDP didn't capture it), probe the API
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

// ─── Data fetching ────────────────────────────────────────────────────────────

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

  // Try api.partner.shopee.vn with various date param formats (no x-sap tokens needed)
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
      console.log('[ShopeePartner] fetchSpfTransactions', JSON.stringify(params), '→ errorCode:', body.errorCode, 'data:', JSON.stringify(body.data).slice(0, 200))
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

  // All variants returned empty — no transactions for this period
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
