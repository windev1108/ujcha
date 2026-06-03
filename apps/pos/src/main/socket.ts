import mqtt from 'mqtt'
import { readFileSync, watchFile } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { readSubConfig, writeSubConfig } from '../renderer/src/store/config-store'

const API_URL = process.env['VITE_API_URL'] || 'http://localhost:5000'
const INTERNAL_KEY = process.env['VITE_INTERNAL_ANALY_KEY'] || ''
const INGEST_URL = `${API_URL}/admin/external/ingest`

// Analy cloud MQTT broker (wss + /mqtt path — confirmed from network capture)
const ANALY_MQTT_URL = process.env['VITE_ANALY_MQTT_URL'] || 'wss://147.136.146.132:8084/mqtt'

// ShopeeFood restaurant IDs: env var takes precedence, then config store
function loadConfiguredIds(): string[] {
  const fromEnv = (process.env['VITE_SPF_RESTAURANT_IDS'] || '').split(',').filter(Boolean)
  if (fromEnv.length > 0) return fromEnv
  const stored = readSubConfig('analySetting') as { spfRestaurantIds?: string[] } | null
  return stored?.spfRestaurantIds ?? []
}

let configuredRestaurantIds: string[] = loadConfiguredIds()

// Tracks restaurant IDs seen on MQTT in debug mode (for Settings auto-detect)
const discoveredRestaurantIds = new Set<string>()
let mqttConnected = false

export interface ShopeeStatus {
  connected: boolean
  email: string | null
  configuredIds: string[]
  discoveredIds: string[]
}

export function getShopeeStatus(): ShopeeStatus {
  return {
    connected: mqttConnected,
    email: currentEmail,
    configuredIds: configuredRestaurantIds,
    discoveredIds: Array.from(discoveredRestaurantIds),
  }
}

export function setSpfRestaurantIds(ids: string[]) {
  writeSubConfig('analySetting', { spfRestaurantIds: ids })
  configuredRestaurantIds = ids
  if (client && mqttConnected) {
    const topics = getTopics()
    client.subscribe(topics, { qos: 1 }, (err) => {
      if (!err) console.log('[ShopeeFood] Resubscribed to:', topics.join(', '))
      else console.error('[ShopeeFood] Resubscribe error:', err.message)
    })
  }
}

// Path đến Analy config.json
const ANALY_CONFIG_PATH = join(app.getPath('appData'), 'Analy', 'config.json')

interface AnalyConfig {
  User?: {
    UserAccessToken?: string
    UserEmail?: string
  }
}

function readAnalyToken(): { token: string; email: string } | null {
  try {
    const raw = readFileSync(ANALY_CONFIG_PATH, 'utf-8')
    const cfg = JSON.parse(raw) as AnalyConfig
    const token = cfg.User?.UserAccessToken
    const email = cfg.User?.UserEmail
    if (token && email) return { token, email }
    return null
  } catch {
    return null
  }
}

// ─── MQTT message types (confirmed from live capture) ────────────────────────

/** ShopeeFood push to restaurant-specific topic: /restaurant/{id} */
interface SpfRestaurantPush {
  new?: string        // "1" = new order
  update?: string     // "1" = order update
  push_id?: string
  target?: string     // "action=order&status=N&is_asap=1&code=07056-XXXXX"
  msg?: string        // "Shipper X arrived at merchant"
  order_code?: string
  pushTime?: string
}

/** ShopeeFood broadcast: /ocha topic */
interface SpfOchaPush {
  order_id?: number
  push_type?: number  // 1=order update, 3=merchant status
  extra_data?: {
    order_status?: number
    order_serial?: string
    status?: number
    from_time?: string
    to_time?: string
  }
  restaurant_id?: number
  order_code?: string
}

function parseTarget(target: string): { action: string; params: Record<string, string> } {
  const [action, ...rest] = target.replace('action=', '').split('&')
  const params: Record<string, string> = {}
  for (const part of rest) {
    const [k, v] = part.split('=')
    if (k) params[k] = v ?? ''
  }
  return { action: action ?? '', params }
}

function isNewOrder(msg: SpfRestaurantPush): boolean {
  // new="1" hoặc target chứa action=order với status nhỏ (1-3 = new/placed)
  if (msg.new === '1') return true
  if (msg.target) {
    const { action, params } = parseTarget(msg.target)
    if (action === 'order') {
      const status = Number(params['status'] ?? -1)
      // ShopeeFood new order statuses: 1=placed, 2=confirmed
      return status >= 1 && status <= 3
    }
  }
  return false
}

// ─── MQTT client state ────────────────────────────────────────────────────────

let client: ReturnType<typeof mqtt.connect> | null = null
let destroyed = false
let currentToken: string | null = null
let currentEmail: string | null = null

const RECONNECT_DELAY = 5000
const MAX_RECONNECTS = 30
let reconnects = 0

function getTopics(): string[] {
  if (configuredRestaurantIds.length === 0) return []
  return [
    ...configuredRestaurantIds.map(id => `/restaurant/${id}`),
    '/ocha',
  ]
}

function connect() {
  if (destroyed) return

  const creds = readAnalyToken()
  if (!creds) {
    console.warn('[ShopeeFood] Chưa tìm thấy token — Analy chưa đăng nhập hoặc config.json không tồn tại')
    console.warn('[ShopeeFood] Path:', ANALY_CONFIG_PATH)
    scheduleReconnect()
    return
  }

  currentToken = creds.token
  currentEmail = creds.email

  console.log('[ShopeeFood] Connecting MQTT to', ANALY_MQTT_URL, 'as', currentEmail)

  client = mqtt.connect(ANALY_MQTT_URL, {
    username: currentEmail,
    password: currentToken,
    clientId: `ujcha-pos-${Date.now().toString(36)}`,
    reconnectPeriod: 0,       // manual reconnect
    connectTimeout: 10_000,
    protocolVersion: 4,
    rejectUnauthorized: false, // Analy dùng self-signed cert
    keepalive: 60,
  })

  client.on('connect', (ack) => {
    reconnects = 0
    mqttConnected = true
    console.log('[ShopeeFood] MQTT connected returnCode=' + ack.returnCode)

    const topics = getTopics()
    if (topics.length === 0) {
      console.warn('[ShopeeFood] Restaurant IDs chưa cấu hình — chưa subscribe topic nào')
      return
    }
    client!.subscribe(topics, { qos: 1 }, (err, granted) => {
      if (err) {
        console.error('[ShopeeFood] Subscribe error:', err.message)
      } else {
        console.log('[ShopeeFood] Subscribed to:', granted?.map(g => g.topic).join(', '))
      }
    })
  })

  client.on('message', (topic: string, payload: Buffer) => {
    const raw = payload.toString()
    void handleMessage(topic, raw)
  })

  client.on('error', (err: Error) => {
    console.error('[ShopeeFood] MQTT error:', err.message)
  })

  client.on('close', () => {
    mqttConnected = false
    console.warn('[ShopeeFood] MQTT disconnected')
    scheduleReconnect()
  })

  client.on('offline', () => {
    console.warn('[ShopeeFood] MQTT offline')
  })
}

async function handleMessage(topic: string, raw: string) {
  // Bỏ qua $SYS topics
  if (topic.startsWith('$SYS')) return

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return
  }

  // ── /restaurant/{id} — ShopeeFood restaurant notification ──────────────────
  if (topic.startsWith('/restaurant/')) {
    const restaurantId = topic.replace('/restaurant/', '')
    const msg = parsed as SpfRestaurantPush

    // Track all discovered restaurant IDs for Settings UI auto-detect
    if (restaurantId && !isNaN(Number(restaurantId))) {
      discoveredRestaurantIds.add(restaurantId)
    }

    if (!isNewOrder(msg)) return

    // Extract order code từ target
    let orderCode: string | undefined = msg.order_code
    if (!orderCode && msg.target) {
      const { params } = parseTarget(msg.target)
      orderCode = params['code']
    }

    if (!orderCode) {
      console.warn('[ShopeeFood] New order nhưng không tìm thấy order_code:', raw)
      return
    }

    console.log(`[ShopeeFood] NEW ShopeeFood order — restaurantId=${restaurantId} code=${orderCode}`)
    await forwardToIngest({ source: 'shopee', restaurantId, orderCode, raw })
    return
  }

  // ── /ocha — ShopeeFood broadcast ──────────────────────────────────────────
  if (topic === '/ocha') {
    const msg = parsed as SpfOchaPush
    const rid = String(msg.restaurant_id ?? '')
    if (!configuredRestaurantIds.includes(rid)) return
    if (msg.push_type === 1 && msg.extra_data?.order_status === 1 && msg.order_code) {
      console.log(`[ShopeeFood] /ocha new order — restaurantId=${rid} code=${msg.order_code}`)
      await forwardToIngest({ source: 'shopee', restaurantId: rid, orderCode: msg.order_code, raw })
    }
    return
  }
}

async function forwardToIngest(data: {
  source: string
  restaurantId: string
  orderCode: string
  raw: string
}) {
  try {
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(INTERNAL_KEY ? { 'x-internal-key': INTERNAL_KEY } : {}),
      },
      body: JSON.stringify({
        raw: data.raw,
        source: data.source,
        restaurantId: data.restaurantId,
        orderCode: data.orderCode,
      }),
    })

    if (!res.ok) {
      console.error('[ShopeeFood] Ingest HTTP error:', res.status, await res.text().catch(() => ''))
      return
    }

    const body = await res.json() as Record<string, unknown>
    console.log('[ShopeeFood] Ingest result:', body['status'], body['orderId'] ?? body['error'] ?? body['orderCode'] ?? '')

    if (body['status'] === 'product_mismatch') {
      console.warn('[ShopeeFood] Sản phẩm chưa khớp:', body['mismatches'])
    }
  } catch (err) {
    console.error('[ShopeeFood] Ingest fetch error:', err)
  }
}

function scheduleReconnect() {
  if (destroyed) return
  if (reconnects >= MAX_RECONNECTS) {
    console.error(`[ShopeeFood] Đã thử ${MAX_RECONNECTS} lần — dừng kết nối`)
    return
  }
  reconnects++
  const delay = Math.min(RECONNECT_DELAY * Math.min(reconnects, 6), 60_000)
  console.log(`[ShopeeFood] Reconnect sau ${Math.round(delay / 1000)}s (lần ${reconnects}/${MAX_RECONNECTS})`)
  setTimeout(connect, delay)
}

export function destroyShopeeSocket() {
  destroyed = true
  client?.end(true)
  client = null
}

// ─── Khởi động ────────────────────────────────────────────────────────────────
connect()

// Watch config.json — tự reconnect nếu Analy đăng nhập lại
try {
  watchFile(ANALY_CONFIG_PATH, { interval: 10_000 }, () => {
    const newCreds = readAnalyToken()
    if (newCreds && newCreds.token !== currentToken) {
      console.log('[ShopeeFood] Token mới detected — reconnect')
      client?.end(true)
      reconnects = 0
      connect()
    }
  })
} catch { /* file không tồn tại */ }
