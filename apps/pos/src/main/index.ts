import { app, BrowserWindow, ipcMain, Menu, nativeTheme, screen, shell } from 'electron'
import { join } from 'path'
import { readConfig, writeConfig, readSubConfig, writeSubConfig } from '../renderer/src/store/config-store'
import { connectedPrinters, registerPrinterHandlers } from '../renderer/src/lib/printer-handler'
import { getGrabStatus, connectGrabByCredentials, syncGrabSession, saveGrabAuthHeaders, resetGrabSession, startGrabPolling, stopGrabPolling, resumeGrabPolling, fetchGrabOrderList, fetchGrabOrderDetailById, fetchGrabPreparingOrderList, fetchGrabLiveOrders, markGrabOrderReady, setGrabMerchantId, syncGrabRevenueSummary, applyPollInterval, startDailySyncQueue, setOnNewOrderCallback } from './grab-poller'
import { getSpfPartnerStatus, saveSpfPartnerSession, resetSpfPartnerSession, startSpfPartnerPolling, stopSpfPartnerPolling, resumeSpfPartnerPolling, fetchSpfTransactions, applySpfPollInterval, setOnNewSpfOrderCallback, fetchSpfRestaurantList } from './shopee-partner-poller'
import { registerAiHandlers } from './ai-agent/registerHandlers'
import { setupUpdater, registerUpdaterHandlers } from './updater'
import { readFileSync } from 'fs'


// Allow audio autoplay from non-user-gesture contexts (socket events, polling)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

const isDev = !app.isPackaged
const RENDERER_URL = process.env['ELECTRON_RENDERER_URL']

interface SavedPrinter { id: string }
export { readSubConfig, writeSubConfig }

const iconPath = isDev
  ? join(app.getAppPath(), 'src/assets/favicon.png')
  : join(process.resourcesPath, 'icon.png')

let staffWin: BrowserWindow | null = null
let customerWin: BrowserWindow | null = null

// ── Window helpers ───────────────────────────────────────────────────────────
function loadWindow(win: BrowserWindow, mode: 'staff' | 'customer') {
  if (isDev && RENDERER_URL) {
    win.loadURL(`${RENDERER_URL}?mode=${mode}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { search: `?mode=${mode}` })
  }
}

function createStaffWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  Menu.setApplicationMenu(null)
  staffWin = new BrowserWindow({
    width: Math.min(1440, width),
    height: Math.min(900, height),
    minWidth: 1024,
    minHeight: 680,
    title: 'UjCha POS',
    icon: iconPath,
    backgroundColor: '#f5f6fa',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  staffWin.once('ready-to-show', () => {
    staffWin?.show()
    if (isDev) staffWin?.webContents.openDevTools({ mode: 'detach' })
  })

  loadWindow(staffWin, 'staff')

  staffWin.on('closed', () => {
    staffWin = null
    customerWin?.close()
    customerWin = null
  })
}

function createCustomerWindow() {
  const displays = screen.getAllDisplays()
  const primary = screen.getPrimaryDisplay()
  const secondary = displays.find((d) => d.id !== primary.id)
  const target = secondary ?? primary
  const { bounds } = target

  customerWin = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: secondary ? bounds.width : 1024,
    height: secondary ? bounds.height : 640,
    title: 'UjCha POS — Màn hình khách',
    icon: iconPath,
    backgroundColor: '#0f1f1a',
    fullscreen: !!secondary,
    frame: !secondary,
    kiosk: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  customerWin.once('ready-to-show', () => customerWin?.show())
  loadWindow(customerWin, 'customer')
  customerWin.webContents.on('did-finish-load', () => {
    try {
      const aiCfg = readSubConfig('aiApp') as { enabled?: boolean; name?: string } | null
      if (aiCfg?.enabled) {
        customerWin?.webContents.send('customer:update', {
          type: 'ai-mode',
          enabled: true,
          name: aiCfg.name ?? 'Thu',
        })
      }
    } catch { /* ignore */ }
  })
  customerWin.on('closed', () => { customerWin = null })
}

// ── IPC handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('app:version', () => app.getVersion())
ipcMain.handle('store:get', () => readConfig())
ipcMain.handle('store:set', (_, data: Record<string, unknown>) => writeConfig(data))

// Persist TTS config pushed from renderer — no in-memory cache, always read from disk
ipcMain.handle('tts:getConfig', () => (readSubConfig('ttsConfig') as Record<string, unknown> | null) ?? {})
ipcMain.handle('tts:setConfig', (_, cfg: Record<string, unknown>) => {
  writeSubConfig('ttsConfig', cfg)
  console.log('[TTS] Config saved — voice:', cfg['voice'], 'speed:', cfg['speed'])
})

// TTS via Node.js — bypasses CORS entirely
ipcMain.handle('tts:speak', async (_, text: string) => {
  try {
    const token = process.env['VIETTEL_TTS_TOKEN'] || ''
    if (!token) {
      console.warn('[TTS] Chưa cấu hình VIETTEL_TTS_TOKEN trong .env')
      return null
    }
    // Read TTS config fresh from disk every call so admin changes are always picked up
    const savedCfg = (readSubConfig('ttsConfig') as Record<string, unknown> | null) ?? {}
    const payload = {
      speed: 1,
      voice: 'hcm-diemmy',
      tts_return_option: 3,
      without_filter: false,
      ...savedCfg,
      text,
      token,
    }
    console.log('[TTS] speak — voice:', payload.voice, 'speed:', payload.speed)
    const res = await fetch('https://viettelai.vn/tts/speech_synthesis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.warn(`[TTS] HTTP ${res.status}:`, errText.slice(0, 120))
      return null
    }
    const buf = await res.arrayBuffer()
    if (buf.byteLength < 200) {
      console.warn('[TTS] Response quá nhỏ, có thể là lỗi JSON:', Buffer.from(buf).toString('utf8').slice(0, 120))
      return null
    }
    return buf
  } catch (e) {
    console.warn('[TTS] error:', e)
    return null
  }
})

// Relay cart/payment state from staff window → customer window
ipcMain.on('customer:update', (_, data: unknown) => {
  customerWin?.webContents.send('customer:update', data)
})

ipcMain.handle('customer:toggle', (_, show: boolean) => {
  if (show && !customerWin) createCustomerWindow()
  else if (show) customerWin?.show()
  else customerWin?.hide()
})

ipcMain.handle('shell:open', (_, url: string) => shell.openExternal(url))

// ── GrabFood ──────────────────────────────────────────────────────────────────
ipcMain.handle('grab:getStatus', () => getGrabStatus())
ipcMain.handle('grab:connect', async (_, username: string, password: string, otp?: string) => {
  const result = await connectGrabByCredentials(username, password, otp)
  if (result.ok && result.connected) resumeGrabPolling()
  return result
})
ipcMain.handle('grab:sync', () => syncGrabSession())
ipcMain.handle('grab:webLogin', () => {
  return new Promise<{ ok: boolean; merchantName?: string; error?: string }>((resolve) => {
    let settled = false
    const settle = (v: { ok: boolean; merchantName?: string; error?: string }) => {
      if (settled) return; settled = true; resolve(v)
    }

    const capturedApiHeaders: Record<string, string> = {}

    const win = new BrowserWindow({
      width: 1024,
      height: 740,
      parent: staffWin ?? undefined,
      modal: false,
      title: 'GrabFood — Đăng nhập → chờ trang portal load → bấm nút xanh',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: 'persist:grab-merchant',
      },
    })

    const ua = win.webContents.getUserAgent().replace(/\s*Electron\/[\d.]+/i, '')
    win.webContents.setUserAgent(ua)

    // CDP: capture JWT from grabid login response + custom headers from API requests
    const SKIP_EXTS = /\.(js|css|png|jpg|ico|woff|woff2|svg|gif|map)(\?|$)/i
    const SKIP_REQ_HEADERS = new Set(['user-agent', 'accept', 'accept-language', 'accept-encoding', 'connection', 'content-length', 'access-control-request-method', 'access-control-request-headers', 'sec-fetch-mode', 'sec-fetch-dest', 'sec-fetch-site', 'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform'])
    try {
      win.webContents.debugger.attach('1.3')
      void win.webContents.debugger.sendCommand('Network.enable')
      win.webContents.debugger.on('message', async (_, cdpMethod, params) => {
        // ── Capture JWT from grabid/authn login response ─────────────────────
        if (cdpMethod === 'Network.responseReceived') {
          const rp = params as { requestId?: string; response?: { url?: string; status?: number } }
          const rUrl = rp.response?.url ?? ''
          const status = rp.response?.status ?? 0
          if (status === 200 && (rUrl.includes('grabid') || rUrl.includes('authn')) && rUrl.includes('login')) {
            try {
              const resp = await win.webContents.debugger.sendCommand('Network.getResponseBody', { requestId: rp.requestId }) as { body?: string; base64Encoded?: boolean }
              const text = resp.base64Encoded ? Buffer.from(resp.body ?? '', 'base64').toString('utf-8') : (resp.body ?? '')
              const data = JSON.parse(text) as Record<string, unknown>
              console.log('[GrabFood] grabid login response keys:', Object.keys(data).join(', '))
              const jwt = (data['access_token'] ?? data['accessToken'] ?? data['id_token'] ?? data['idToken'] ?? data['token']) as string | undefined
              if (jwt) {
                capturedApiHeaders['Authorization'] = `Bearer ${jwt}`
                console.log('[GrabFood] JWT captured:', jwt.slice(0, 50) + '...')
              }
            } catch { /* ignore */ }
          }
          return
        }

        if (cdpMethod !== 'Network.requestWillBeSent') return
        const p = params as { request?: { url?: string; headers?: Record<string, string>; method?: string } }
        const url = p.request?.url ?? ''

        if ((url.includes('grab.com') || url.includes('deliverynow.vn')) && !SKIP_EXTS.test(url)) {
          console.log('[GrabFood] CDP URL:', url.replace(/\?.*/, ''))
        }

        // Capture custom headers (merchantID, merchantGroupID, requestSource) from actual API requests
        // Skip preflight (OPTIONS) requests — they only have CORS headers, not auth
        if (p.request?.method === 'OPTIONS') return
        if (!url.includes('api.grab.com/delvplatformapi') && !url.includes('api.grab.com/food') && !url.includes('portal.grab.com') && !url.includes('merchant.grab.com')) return

        const headers = p.request?.headers ?? {}
        for (const [k, v] of Object.entries(headers)) {
          if (!SKIP_REQ_HEADERS.has(k.toLowerCase())) capturedApiHeaders[k] = v
        }
        // Extract merchant_group_id from merchant.grab.com URL query params
        if (url.includes('merchant.grab.com') && url.includes('merchant_group_id=')) {
          try {
            const u = new URL(url)
            const mgId = u.searchParams.get('merchant_group_id')
            if (mgId && !capturedApiHeaders['_merchantGroupID']) capturedApiHeaders['_merchantGroupID'] = mgId
          } catch { /* ignore */ }
        }
        if (url.includes('orders-pagination') && p.request?.method === 'GET') {
          // Store the exact URL (with all query params) for polling replication
          capturedApiHeaders['_pollUrl'] = url
          console.log('[GrabFood] orders-pagination FULL URL:', url)
        }
        console.log('[GrabFood] CDP captured keys:', Object.keys(capturedApiHeaders).filter(k => !k.startsWith('_')).join(', '))
      })
    } catch (e) {
      console.warn('[GrabFood] CDP attach failed:', e)
    }

    win.loadURL('https://weblogin.grab.com/merchant/login?service_id=MEXUSERS&redirect=https%3A%2F%2Fmerchant.grab.com%2Fportal')

    const injectButton = () => {
      const count = Object.keys(capturedApiHeaders).length
      win.webContents.executeJavaScript(`
        (function() {
          const label = ${JSON.stringify(count > 0
        ? `✓ Đã bắt ${count} auth header — Xác nhận lấy session`
        : '✓ Xác nhận đã đăng nhập — Lấy session'
      )};
          let btn = document.getElementById('__kun_grab_btn');
          if (!btn) {
            btn = document.createElement('button');
            btn.id = '__kun_grab_btn';
            btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:999999;background:#00b14f;color:white;border:none;padding:12px 20px;border-radius:12px;font-size:14px;font-weight:bold;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3)';
            btn.onclick = () => { btn.textContent = 'Đang lấy...'; btn.disabled = true; window.__kunGrabCapture = true; };
            document.body.appendChild(btn);
          }
          btn.textContent = label;
        })()
      `).catch(() => { })
    }

    const pollInterval = setInterval(async () => {
      if (settled) { clearInterval(pollInterval); return }
      try {
        const clicked = await win.webContents.executeJavaScript('window.__kunGrabCapture === true')
        if (!clicked) { injectButton(); return }
        clearInterval(pollInterval)

        console.log('[GrabFood] User confirmed — capturedApiHeaders:', JSON.stringify(capturedApiHeaders).slice(0, 200))
        // Copy custom headers (merchantID, requestSource, etc.), skip empty values
        const headersMap: Record<string, string> = {}
        for (const [k, v] of Object.entries(capturedApiHeaders)) {
          if (v && v.trim() !== '') headersMap[k] = v
        }

        // api.grab.com uses HttpOnly cookie-based auth — cookies are not visible in CDP request headers.
        // Must get them directly from the session and add to Cookie header.
        const COOKIE_DOMAINS = ['.grab.com', 'api.grab.com', 'merchant.grab.com', 'portal.grab.com']
        const allSessionCookies: Electron.Cookie[] = []
        for (const domain of COOKIE_DOMAINS) {
          const c = await win.webContents.session.cookies.get({ domain }).catch(() => [] as Electron.Cookie[])
          allSessionCookies.push(...c)
        }
        const seenNames = new Set<string>()
        const authCookies = allSessionCookies.filter(c => {
          if (seenNames.has(c.name)) return false
          seenNames.add(c.name)
          return !c.name.startsWith('_ga') && !c.name.startsWith('_gid') &&
            !c.name.startsWith('_fbp') && !c.name.startsWith('_fb') &&
            !c.name.startsWith('_dd') && !c.name.startsWith('_hp2')
        })
        console.log('[GrabFood] session cookies:', authCookies.map(c => `${c.name}(${c.domain})`).join(', '))
        if (authCookies.length > 0) {
          headersMap['Cookie'] = authCookies.map(c => `${c.name}=${c.value}`).join('; ')
        }

        try { win.webContents.debugger.detach() } catch { /* ignore */ }

        if (Object.keys(headersMap).length === 0) {
          settle({ ok: false, error: 'Không bắt được auth header — bạn đã đăng nhập và chờ portal load xong chưa?' })
          win.close(); return
        }

        const name = await saveGrabAuthHeaders(headersMap)
        resumeGrabPolling()
        win.close()
        settle({ ok: true, merchantName: name ?? undefined })
      } catch { /* window may not be ready */ }
    }, 1000)

    win.on('closed', () => {
      try { win.webContents.debugger.detach() } catch { /* ignore */ }
      clearInterval(pollInterval)
      settle({ ok: false, error: 'Đã đóng cửa sổ' })
    })
  })
})
ipcMain.handle('grab:reset', () => {
  resetGrabSession()
  return { ok: true }
})
ipcMain.handle('grab:setPollInterval', (_e, ms: number) => applyPollInterval(ms))
ipcMain.handle('grab:syncRevenue', (_e, date?: string) => {
  const vnDate = date ?? (() => {
    const ms = Date.now() + 7 * 60 * 60 * 1000
    return new Date(ms).toISOString().slice(0, 10)
  })()
  return syncGrabRevenueSummary(vnDate)
})
ipcMain.handle('grab:listOrders', (_e, startDate?: string, endDate?: string, pageIndex?: number) =>
  fetchGrabOrderList(startDate, endDate, pageIndex ?? 0))
ipcMain.handle('grab:getOrder', (_e, id: string) => fetchGrabOrderDetailById(id))
ipcMain.handle('grab:setMerchantId', (_e, id: string) => { setGrabMerchantId(id); resumeGrabPolling() })
ipcMain.handle('grab:listPreparingOrders', () => fetchGrabPreparingOrderList())
ipcMain.handle('grab:listLiveOrders', (_e, pageType: string) => fetchGrabLiveOrders(pageType))
ipcMain.handle('grab:markOrderReady', (_e, orderID: string, preparationTaskID?: string) =>
  markGrabOrderReady(orderID, preparationTaskID))

// ── ShopeeFood Partner API ────────────────────────────────────────────────────
ipcMain.handle('spfPartner:getStatus', () => getSpfPartnerStatus())
ipcMain.handle('spfPartner:reset', () => { resetSpfPartnerSession(); return { ok: true } })
ipcMain.handle('spfPartner:getTransactions', (_e, restaurantId: string, fromDate: string, toDate: string) =>
  fetchSpfTransactions(restaurantId, fromDate, toDate))
ipcMain.handle('spfPartner:setPollInterval', (_e, ms: number) => applySpfPollInterval(ms))
ipcMain.handle('spfPartner:getRestaurantList', () => fetchSpfRestaurantList())

ipcMain.handle('spfPartner:webLogin', () => {
  return new Promise<{ ok: boolean; restaurantId?: string; error?: string }>((resolve) => {
    let settled = false
    const settle = (v: { ok: boolean; restaurantId?: string; error?: string }) => {
      if (settled) return; settled = true; resolve(v)
    }

    const capturedHeaders: Record<string, string> = {}
    let capturedRestaurantId: string | null = null
    let capturedRestaurantName: string | null = null

    const win = new BrowserWindow({
      width: 1100,
      height: 760,
      parent: staffWin ?? undefined,
      modal: false,
      title: 'ShopeeFood Partner — Đăng nhập → chọn nhà hàng → bấm nút đỏ',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: 'persist:spf-partner',
      },
    })

    const ua = win.webContents.getUserAgent().replace(/\s*Electron\/[\d.]+/i, '')
    win.webContents.setUserAgent(ua)

    const SKIP_REQ_HEADERS = new Set([
      'user-agent', 'accept', 'accept-language', 'accept-encoding', 'connection',
      'content-length', 'access-control-request-method', 'access-control-request-headers',
      'sec-fetch-mode', 'sec-fetch-dest', 'sec-fetch-site', 'sec-ch-ua', 'sec-ch-ua-mobile',
      'sec-ch-ua-platform', 'sec-fetch-storage-access', 'priority',
    ])

    try {
      win.webContents.debugger.attach('1.3')
      void win.webContents.debugger.sendCommand('Network.enable')
      win.webContents.debugger.on('message', async (_, cdpMethod, params) => {
        if (cdpMethod === 'Network.requestWillBeSent') {
          const p = params as { requestId?: string; request?: { url?: string; headers?: Record<string, string>; method?: string } }
          const url = p.request?.url ?? ''
          if (p.request?.method === 'OPTIONS') return
          const isSpfApi = url.includes('gmerchant.deliverynow.vn') || url.includes('partner.shopee.vn') || url.includes('partner.business.accounts.shopee.vn')
          if (!isSpfApi) return

          const headers = p.request?.headers ?? {}
          for (const [k, v] of Object.entries(headers)) {
            if (!SKIP_REQ_HEADERS.has(k.toLowerCase())) capturedHeaders[k] = v
          }

          // Log every API endpoint — helps discover order endpoints
          if (url.includes('gmerchant.deliverynow.vn') || url.includes('api.') || url.includes('/api/')) {
            console.log('[ShopeePartner] Portal→API:', p.request?.method, url.replace(/\?.*/, ''))
          }

          // Capture restaurant_id from URL query params (fallback)
          if (url.includes('gmerchant.deliverynow.vn') && url.includes('restaurant_id=')) {
            try {
              const u = new URL(url)
              const rid = u.searchParams.get('restaurant_id')
              if (rid && !capturedRestaurantId) {
                capturedRestaurantId = rid
                console.log('[ShopeePartner] Captured restaurant_id from URL:', rid)
              }
            } catch { /* ignore */ }
          }
          console.log('[ShopeePartner] CDP keys:', Object.keys(capturedHeaders).filter(k => !k.startsWith('_')).join(', '))
        }

        if (cdpMethod === 'Network.responseReceived') {
          const p = params as { requestId?: string; response?: { url?: string; status?: number } }
          const url = p.response?.url ?? ''
          if (!url.includes('get_basic_infos_for_partner_web')) return
          if (p.response?.status !== 200 || !p.requestId) return
          try {
            const result = await win.webContents.debugger.sendCommand('Network.getResponseBody', { requestId: p.requestId })
            const body = JSON.parse((result as { body: string }).body) as {
              code: number
              data?: { restaurants?: Array<{ restaurant_id: number; store_id: number; name: string }> }
            }
            if (body.code === 0 && body.data?.restaurants?.[0]) {
              const r = body.data.restaurants[0]
              capturedRestaurantId = String(r.restaurant_id)
              capturedRestaurantName = r.name
              console.log('[ShopeePartner] Captured restaurant from response — id:', capturedRestaurantId, 'name:', r.name)
            }
          } catch (e) {
            console.warn('[ShopeePartner] Could not read response body:', e)
          }
        }
      })
    } catch (e) {
      console.warn('[ShopeePartner] CDP attach failed:', e)
    }

    win.loadURL(
      'https://partner.business.accounts.shopee.vn/authenticate/login/?lang=vn&should_hide_back=true&state=https%3A%2F%2Fpartner.shopee.vn%2F&client_id=5'
    )

    const injectButton = () => {
      const count = Object.keys(capturedHeaders).filter(k => !k.startsWith('_')).length
      win.webContents.executeJavaScript(`
        (function() {
          const label = ${JSON.stringify(
        count > 0
          ? `✓ Đã bắt ${count} header — Xác nhận kết nối ShopeeFood`
          : '✓ Xác nhận đã chọn nhà hàng'
      )};
          let btn = document.getElementById('__kun_spf_btn');
          if (!btn) {
            btn = document.createElement('button');
            btn.id = '__kun_spf_btn';
            btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:999999;background:#EE4D2D;color:white;border:none;padding:12px 20px;border-radius:12px;font-size:14px;font-weight:bold;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3)';
            btn.onclick = () => { btn.textContent = 'Đang lấy...'; btn.disabled = true; window.__kunSpfCapture = true; };
            document.body.appendChild(btn);
          }
          btn.textContent = label;
        })()
      `).catch(() => { })
    }

    const pollInterval = setInterval(async () => {
      if (settled) { clearInterval(pollInterval); return }
      try {
        const currentUrl = win.webContents.getURL()
        if (!currentUrl.includes('partner.shopee.vn')) return

        const clicked = await win.webContents.executeJavaScript('window.__kunSpfCapture === true')
        if (!clicked) { injectButton(); return }
        clearInterval(pollInterval)

        const headersMap: Record<string, string> = {}
        for (const [k, v] of Object.entries(capturedHeaders)) {
          if (v && v.trim() !== '') headersMap[k] = v
        }

        // Collect auth cookies from session
        const COOKIE_DOMAINS = ['.shopee.vn', 'partner.shopee.vn', 'gmerchant.deliverynow.vn', '.deliverynow.vn']
        const allCookies: Electron.Cookie[] = []
        for (const domain of COOKIE_DOMAINS) {
          const c = await win.webContents.session.cookies.get({ domain }).catch(() => [] as Electron.Cookie[])
          allCookies.push(...c)
        }
        const seen = new Set<string>()
        const authCookies = allCookies.filter(c => {
          if (seen.has(c.name)) return false
          seen.add(c.name)
          return !c.name.startsWith('_ga') && !c.name.startsWith('_gid') &&
            !c.name.startsWith('_fbp') && !c.name.startsWith('_hp2')
        })
        console.log('[ShopeePartner] session cookies:', authCookies.map(c => `${c.name}(${c.domain})`).join(', '))
        if (authCookies.length > 0) {
          headersMap['Cookie'] = authCookies.map(c => `${c.name}=${c.value}`).join('; ')
        }

        const nonPrivateKeys = Object.keys(headersMap).filter(k => !k.startsWith('_'))
        if (nonPrivateKeys.length === 0) {
          settle({ ok: false, error: 'Không bắt được auth header — bạn đã đăng nhập và chọn nhà hàng chưa?' })
          win.close(); return
        }

        try { win.webContents.debugger.detach() } catch { /* ignore */ }

        const restaurantId = capturedRestaurantId ?? undefined
        const restaurantName = capturedRestaurantName ?? undefined
        await saveSpfPartnerSession(headersMap, restaurantId, restaurantName)
        resumeSpfPartnerPolling()
        win.close()
        settle({ ok: true, restaurantId })
      } catch { /* window may not be ready */ }
    }, 1000)

    win.on('closed', () => {
      try { win.webContents.debugger.detach() } catch { /* ignore */ }
      clearInterval(pollInterval)
      settle({ ok: false, error: 'Đã đóng cửa sổ' })
    })
  })
})

ipcMain.handle('font:getBase64', () => {
  try {
    const fontPath = isDev
      ? join(app.getAppPath(), 'src/renderer/src/assets/fonts/static/JetBrainsMono-Bold.ttf')
      : join(__dirname, '../../renderer/fonts/static/JetBrainsMono-Bold.ttf')

    return `data:font/truetype;base64,${readFileSync(fontPath).toString('base64')}`
  } catch (e) {
    console.error('[font] load failed:', e)
    return ''
  }
})

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  nativeTheme.themeSource = 'light'
  createStaffWindow()
  createCustomerWindow()
  registerPrinterHandlers()
  console.log('[main] printer-handler v3 (fire-and-forget queue) loaded')
  console.log('📁 Config file path:', join(app.getPath('userData'), 'pos-config.json'))

  const saved = readConfig()['connectedPrinters'] as SavedPrinter[] | undefined
  if (saved?.length) {
    for (const p of saved) connectedPrinters.set(p.id, p as never)
  }

  registerAiHandlers(() => staffWin)
  registerUpdaterHandlers()
  setupUpdater(() => staffWin)

  // Start GrabFood polling (notification only — no order ingest)
  setOnNewOrderCallback((id: string) => staffWin?.webContents.send('grab:newOrder', id))
  startGrabPolling()
  startDailySyncQueue()

  // Start ShopeeFood Partner polling (notification only)
  setOnNewSpfOrderCallback((code: string) => staffWin?.webContents.send('spfPartner:newOrder', code))
  startSpfPartnerPolling()

  app.on('activate', () => {
    if (!staffWin) createStaffWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopGrabPolling()
  stopSpfPartnerPolling()
})
