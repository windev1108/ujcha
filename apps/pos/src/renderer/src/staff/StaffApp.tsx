import { useEffect, useState, useCallback, useRef } from 'react'
import { ClipboardList, Settings, Monitor, LogOut, Bell, Bot } from 'lucide-react'
import { io } from 'socket.io-client'
import { usePosStore } from '../store/pos-store'
import { fetchCategories, fetchProducts, fetchTables, fetchPaymentConfig, API_URL, fetchTtsConfig, fetchOrders } from '../api'
import type { Product, PosConfig, CustomerUpdate, AdminOrder } from '../types/common'
import { DEFAULT_CONFIG, DEFAULT_BILL_CONFIG, DEFAULT_LABEL_CONFIG } from '../types/common'
import type { BillConfig, LabelConfig } from '../../../preload'
import { KEYS, loadLocal } from '../lib/local-storage'
import { grabFullToAdminOrder, printGrabBill, printGrabLabels } from '../lib/grab-print'
import type { GrabFull } from '../lib/grab-print'
import logoUrl from '../assets/logo.png'
import grabFoodLogo from '../assets/grab-food.png'
import shopeeFoodLogo from '../assets/shopee-food.png'
import grfVoiceUrl from '../assets/mp3/grf-voice.mp3'
import newOrderMp3 from '../assets/mp3/new-order.mp3'
import spfVoiceUrl from '../assets/mp3/spf-voice.mp3'
import { LoginScreen } from './LoginScreen'
import { CategoryBar } from '../components/CategoryBar'
import { ProductGrid } from '../components/ProductGrid'
import { CartPanel } from '../components/CartPanel'
import { CheckoutModal } from '../components/CheckoutModal'
import { OrdersModal } from '../components/OrdersModal'
import { ExternalOrdersModal } from '../components/ExternalOrdersModal'
import { SettingsPage } from '../components/SettingPage'
import { AIOrderPanel } from '../components/AIOrderPanel'
import { UpdateModal, type UpdateInfo } from '../components/UpdateModal'

const eAPI = (window as unknown as {
  electronAPI?: {
    store: { get(): Promise<Record<string, unknown>>; set(d: Record<string, unknown>): Promise<void> }
    customer: { update(d: CustomerUpdate): void; toggle(show: boolean): Promise<void> }
    tts?: { speak(text: string): Promise<ArrayBuffer | null>; setConfig(cfg: Record<string, unknown>): Promise<void> }
    grab?: {
      getStatus(): Promise<{ hasAuth: boolean; polling: boolean; lastPollStatus: string }>
      connect(u: string, p: string, otp?: string): Promise<{ ok: boolean; connected: boolean; needsOtp?: boolean; stores: unknown[]; error?: string }>
      getOrder(id: string): Promise<{ ok: boolean; order?: Record<string, unknown>; error?: string }>
      onNewOrder(cb: (id: string) => void): () => void
    }
    spfPartner?: {
      getStatus(): Promise<{ connected: boolean; restaurantId: string | null }>
      onNewOrder(cb: (orderCode: string) => void): () => void
    }
    app?: {
      getVersion(): Promise<string>
    }
    updater?: {
      check(): void
      openDownload(url: string): void
      onAvailable(cb: (info: { version: string; downloadUrl: string; releaseNotes: string | null }) => void): () => void
    }
  }
}).electronAPI

export function StaffApp() {
  const { isLoggedIn, posConfig, setPosConfig, setCategories, setProducts, setIsFetching, setTables, setPaymentConfig } = usePosStore()
  const cart = usePosStore((s) => s.cart)
  const [booted, setBooted] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [ordersOpen, setOrdersOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [aiPaymentMethod, setAiPaymentMethod] = useState<'cash' | 'transfer' | null>(null)
  const [aiListening, setAiListening] = useState(false)
  const clearAiSessionRef = useRef<(() => void) | null>(null)
  const [newOrderBadge, setNewOrderBadge] = useState(0)
  const [externalOpen, setExternalOpen] = useState(false)
  const [externalInitialTab, setExternalInitialTab] = useState<'all' | 'grabfood' | 'shopeefood' | 'other'>('all')
  const [newGrabBadge, setNewGrabBadge] = useState(0)
  const [newShopeeBadge, setNewShopeeBadge] = useState(0)
  const [grabConnected, setGrabConnected] = useState(false)
  const [shopeePartnerConnected, setShopeePartnerConnected] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [appVersion, setAppVersion] = useState('')
  const [socketConnected, setSocketConnected] = useState(false)

  // ── Auto-print dedup: track order IDs already printed this session ─────────
  const autoPrintedIdsRef = useRef<Set<string>>(new Set())

  // ── Alert audio: local MP3 files ──────────────────────────────────────────
  const alertIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const alertUrlRef = useRef<string>('')
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  const playMp3 = useCallback((url: string) => {
    try {
      currentAudioRef.current?.pause()
      const audio = new Audio(url)
      currentAudioRef.current = audio
      audio.play().catch(() => { })
    } catch { /* ignore */ }
  }, [])

  const stopAlert = useCallback(() => {
    if (alertIntervalRef.current) { clearInterval(alertIntervalRef.current); alertIntervalRef.current = null }
    currentAudioRef.current?.pause()
    currentAudioRef.current = null
  }, [])

  // Keep as alias so existing call-sites (stopAlertInterval) still work
  const stopAlertInterval = stopAlert

  const startAlert = useCallback((url: string) => {
    stopAlert()
    alertUrlRef.current = url
    playMp3(url)
    alertIntervalRef.current = setInterval(() => playMp3(alertUrlRef.current), 8_000)
  }, [stopAlert, playMp3])

  // Alert handler ref — lets the socket closure always call the latest logic
  const alertHandlerRef = useRef<(p: string) => void>(() => { })
  alertHandlerRef.current = (platform: string) => {
    const url = platform.includes('GRAB') ? grfVoiceUrl : platform.includes('SHOPEE') ? spfVoiceUrl : grfVoiceUrl
    startAlert(url)
  }

  // New-order handler ref: badge + audio only when the orders modal is closed
  // (when modal is open, OrdersModal's own socket drives audio via its queue)
  const newOrderHandlerRef = useRef<() => void>(() => { })
  newOrderHandlerRef.current = () => {
    if (!ordersOpen) {
      setNewOrderBadge((n) => n + 1)
      startAlert(newOrderMp3)
    }
  }

  // ── Boot: restore saved session ─────────────────────────────────────────────
  useEffect(() => {
    const boot = async () => {
      const saved = await eAPI?.store.get()
      if (saved?.accessToken && saved?.adminUser) {
        setPosConfig({ ...DEFAULT_CONFIG, ...(saved as unknown as PosConfig) })
      }
      setBooted(true)
    }
    void boot()
  }, [setPosConfig])

  // Cleanup on logout — reset customer screen and alerts
  useEffect(() => {
    if (!isLoggedIn) {
      stopAlert()
      // Reset customer display fully: disable AI mode then go idle
      eAPI?.customer.update({ type: 'ai-mode', enabled: false, name: 'UjCha' })
      eAPI?.customer.update({ type: 'idle' })
    }
    return () => stopAlert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn])

  // ── Grab new-order IPC (main process → renderer) ──────────────────────────
  useEffect(() => {
    if (!isLoggedIn) return
    const unsub = eAPI?.grab?.onNewOrder?.((id: string) => {
      setNewGrabBadge(n => n + 1)
      alertHandlerRef.current('GRAB')

      // Auto-print bill/label if configured and this order hasn't been printed yet
      const billCfg = loadLocal<BillConfig>(KEYS.bill, DEFAULT_BILL_CONFIG)
      const labelCfg = loadLocal<LabelConfig>(KEYS.label, DEFAULT_LABEL_CONFIG)
      const shouldBill = billCfg.enabled && billCfg.autoPrint && !!(billCfg.address || billCfg.printerId)
      const shouldLabel = labelCfg.enabled && labelCfg.autoPrint && !!(labelCfg.address || labelCfg.printerId)

      if ((shouldBill || shouldLabel) && id && !autoPrintedIdsRef.current.has(id)) {
        autoPrintedIdsRef.current.add(id)
        void (async () => {
          try {
            const result = await eAPI!.grab!.getOrder(id)
            if (result.ok && result.order) {
              const adminOrder = grabFullToAdminOrder(result.order as GrabFull)
              if (shouldBill) {
                void printGrabBill(adminOrder).then(r => {
                  if (!r.ok) console.warn('[auto-print bill]', id, r.error)
                  else console.log('[auto-print bill] ✅', id)
                })
              }
              if (shouldLabel) {
                void printGrabLabels(result.order as GrabFull as any).then(r => {
                  if (!r.ok) console.warn('[auto-print label]', id, r.error)
                  else console.log('[auto-print label] OK', id)
                })
              }
            }
          } catch (e) {
            console.warn('[auto-print] getOrder error:', e)
          }
        })()
      }
    })
    return () => unsub?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn])

  // ── Load data when logged in ────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn) return
    const load = async () => {
      setIsFetching(true)
      const today = new Date().toISOString().slice(0, 10)
      const [cats, prods, tabs, pay, tts, initOrders] = await Promise.allSettled([
        fetchCategories(), fetchProducts(), fetchTables(), fetchPaymentConfig(), fetchTtsConfig(),
        fetchOrders(1, 200, today, today),
      ])
      if (cats.status === 'fulfilled') setCategories(cats.value)
      if (prods.status === 'fulfilled') {
        setProducts(prods.value)
        setIsFetching(false)
      }
      if (tabs.status === 'fulfilled') setTables(tabs.value)
      if (pay.status === 'fulfilled') setPaymentConfig(pay.value)
      if (tts.status === 'fulfilled') {
        const fresh = usePosStore.getState().posConfig
        setPosConfig({ ...fresh, ttsConfig: { ...tts.value, token: '' } })
        void eAPI?.tts?.setConfig(tts.value as unknown as Record<string, unknown>)
      }
      if (initOrders.status === 'fulfilled') {
        const items = (initOrders.value as { items: AdminOrder[] }).items ?? []
        const pending = items.filter(o => o.status === 'pending').length
        if (pending > 0) setNewOrderBadge(pending)
      }
    }
    void load()
  }, [isLoggedIn, setCategories, setProducts, setTables, setPaymentConfig, setIsFetching])

  // ── ShopeeFood Partner new-order IPC ──────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn) return
    const unsub = eAPI?.spfPartner?.onNewOrder?.((code: string) => {
      setNewShopeeBadge(n => n + 1)
      alertHandlerRef.current('SHOPEE')
      console.log('[StaffApp] SpfPartner new order:', code)
    })
    return () => unsub?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn])

  // ── Poll partner connection status ──────────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn) return
    const poll = async () => {
      const [grab, spfPartner] = await Promise.allSettled([
        eAPI?.grab?.getStatus(),
        eAPI?.spfPartner?.getStatus(),
      ])
      if (grab.status === 'fulfilled' && grab.value) setGrabConnected(grab.value.hasAuth)
      if (spfPartner.status === 'fulfilled' && spfPartner.value) setShopeePartnerConnected(spfPartner.value.connected)
    }
    void poll()
    const t = setInterval(() => void poll(), 5000)
    return () => clearInterval(t)
  }, [isLoggedIn])

  // ── Socket: real-time events ────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn) return
    const socket = io(API_URL, { transports: ['polling', 'websocket'], reconnectionAttempts: Infinity, reconnectionDelay: 2000 })

    socket.on('connect', () => {
      setSocketConnected(true)
      console.log('[socket] connected to', API_URL, 'id:', socket.id)
    })
    socket.on('disconnect', (reason) => {
      setSocketConnected(false)
      console.warn('[socket] disconnected', reason)
    })
    socket.on('connect_error', (err) => {
      setSocketConnected(false)
      console.error('[socket] connect_error', err.message)
    })

    socket.on('order:new', () => {
      console.log('[socket] order:new received')
      newOrderHandlerRef.current()
    })
    socket.on('order:external', (data?: { platform?: string }) => {
      const p = (data?.platform ?? '').toUpperCase()
      if (p.includes('GRAB')) setNewGrabBadge((n) => n + 1)
      else if (p.includes('SHOPEE')) setNewShopeeBadge((n) => n + 1)
      else setNewGrabBadge((n) => n + 1)
      alertHandlerRef.current(p)
    })
    socket.on('order:paid', () => {
      // handled in CheckoutModal for the active order
    })
    // On reconnect: resync pending badge in case order:new was missed during disconnect
    socket.io.on('reconnect', () => {
      const today = new Date().toISOString().slice(0, 10)
      void fetchOrders(1, 100, today, today).then((data: unknown) => {
        const items = ((data as { items: AdminOrder[] }).items ?? [])
        const pending = items.filter((o: AdminOrder) => o.status === 'pending').length
        if (pending > 0) setNewOrderBadge((n) => Math.max(n, pending))
      }).catch(() => {})
    })

    return () => { socket.disconnect() }
  }, [isLoggedIn])

  // ── Sync cart to customer display ──────────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn) return
    const total = usePosStore.getState().cartTotal()

    eAPI?.customer.update(
      cart.length > 0
        ? {
          type: 'cart',
          items: cart.map((i) => {
            const extrasTotal = (i.extras ?? []).reduce((s, e) => s + (e.price ?? 0), 0)
            const unitPrice = i.basePrice + i.optionDelta + extrasTotal
            return {
              name: i.name,
              quantity: i.quantity,
              price: unitPrice * i.quantity,  // tổng giá item (đã gồm options + toppings)
              imageUrl: i.imageUrl,
              options: i.options,
              optionDetails: i.optionDetails,
              extras: i.extras,
              note: i.note || undefined,
            }
          }),
          total,
        }
        : { type: 'idle' },
    )
  }, [cart, isLoggedIn])

  // ── App version (for update modal) ────────────────────────────────────────
  useEffect(() => {
    eAPI?.app?.getVersion().then(setAppVersion).catch(() => { })
  }, [])

  // ── Auto-updater events ────────────────────────────────────────────────────
  useEffect(() => {
    const u = eAPI?.updater
    if (!u) return
    return u.onAvailable((info) => setUpdateInfo(info))
  }, [])

  if (!booted) {
    return (
      <div className="flex h-full items-center justify-center bg-brand">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/30 border-t-white" />
      </div>
    )
  }

  if (!isLoggedIn) return <LoginScreen />

  const adminUser = posConfig.adminUser
  const displayName = adminUser?.name || adminUser?.email || 'Admin'
  const avatarChar = (adminUser?.name || adminUser?.email || 'A')[0].toUpperCase()

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* ── Header ── */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-100 bg-white px-4 shadow-sm">
        {/* Logo */}
        <img src={logoUrl} alt="UjCha" className="h-20 w-24 object-contain" />
        <div className="mx-3 h-6 w-px bg-gray-200" />

        {/* Nav */}
        <button
          onClick={() => { setOrdersOpen(true); setNewOrderBadge(0); stopAlert() }}
          className="relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        >
          <ClipboardList className="size-4" />
          Đơn hàng của quán
          {newOrderBadge > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
              {newOrderBadge}
            </span>
          )}
        </button>

        {grabConnected && (
          <button
            onClick={() => { setExternalOpen(true); setExternalInitialTab('grabfood'); setNewGrabBadge(0); stopAlertInterval() }}
            className="relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          >
            <img src={grabFoodLogo} className="h-5 w-5 object-contain shrink-0" alt="GrabFood" />
            GrabFood
            {newGrabBadge > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] font-bold text-white">
                {newGrabBadge > 9 ? '9+' : newGrabBadge}
              </span>
            )}
          </button>
        )}

        {shopeePartnerConnected && (
          <button
            onClick={() => { setExternalOpen(true); setExternalInitialTab('shopeefood'); setNewShopeeBadge(0); stopAlertInterval() }}
            className="relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          >
            <img src={shopeeFoodLogo} className="h-5 w-5 object-contain shrink-0" alt="ShopeeFood" />
            ShopeeFood
            {newShopeeBadge > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white">
                {newShopeeBadge > 9 ? '9+' : newShopeeBadge}
              </span>
            )}
          </button>
        )}

        {/* Socket connection indicator */}
        <div
          title={socketConnected ? `Đã kết nối: ${API_URL}` : `Mất kết nối: ${API_URL}`}
          className={`ml-1 size-2 rounded-full ${socketConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}
        />

        <div className="flex-1" />

        {/* Actions */}
        {/* <button
          onClick={() => void eAPI?.customer.toggle(true)}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          title="Màn hình khách"
        >
          <Monitor className="size-4" />
        </button> */}

        <button
          onClick={() => setAiPanelOpen((v) => !v)}
          title="AI Thu ngân"
          className={`relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${aiPanelOpen ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-brand'}`}
        >
          <Bot className="size-4" />
          <span className="text-xs font-semibold">AI</span>
          {aiListening && !aiPanelOpen && (
            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-green-400 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
        >
          <Settings className="size-4" />
        </button>

        <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-1.5">
          <div className="grid h-5 w-5 place-items-center rounded-full bg-brand text-[10px] font-bold text-white">
            {avatarChar}
          </div>
          <span className="max-w-[120px] truncate text-xs font-medium text-gray-600">{displayName}</span>
          <button onClick={async () => { await eAPI?.store.set({}); usePosStore.getState().logout() }} className="ml-1 text-gray-400 hover:text-red-500">
            <LogOut className="size-3.5" />
          </button>
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className={`flex flex-1 overflow-hidden transition-all duration-200 ${aiPanelOpen ? 'mr-[400px]' : ''}`}>
        <CategoryBar />
        <ProductGrid />
        <CartPanel onCheckout={() => setCheckoutOpen(true)} />
      </div>

      {/* ── Modals & drawers ── */}
      {checkoutOpen && (
        <CheckoutModal
          onClose={() => { setCheckoutOpen(false); setAiPaymentMethod(null) }}
          initialTab={aiPaymentMethod === 'transfer' ? 'qr' : 'cash'}
          autoConfirm={!!aiPaymentMethod}
          onOrderComplete={() => clearAiSessionRef.current?.()}
        />
      )}
      {ordersOpen && <OrdersModal onClose={() => setOrdersOpen(false)} />}
      {externalOpen && (
        <ExternalOrdersModal
          onClose={() => setExternalOpen(false)}
          initialTab={externalInitialTab}
          grabConnected={grabConnected}
          shopeePartnerConnected={shopeePartnerConnected}
        />
      )}
      {settingsOpen && (
        <SettingsPage
          onClose={() => setSettingsOpen(false)}
          config={posConfig}
          onSave={handleSaveSettings}
        />
      )}
      {isLoggedIn && (
        <AIOrderPanel
          isOpen={aiPanelOpen}
          onClose={() => setAiPanelOpen(false)}
          onCheckout={(pm) => { setAiPaymentMethod(pm); setCheckoutOpen(true) }}
          onListeningChange={setAiListening}
          onRegisterClearSession={(fn) => { clearAiSessionRef.current = fn }}
        />
      )}

      {/* ── Update notification modal ── */}
      {updateInfo && (
        <UpdateModal
          info={updateInfo}
          currentVersion={appVersion}
          onDismiss={() => setUpdateInfo(null)}
        />
      )}
    </div>
  )

  // function handleAddProduct(product: Product) {
  //   const { addToCart } = usePosStore.getState()
  //   addToCart({
  //     productId: product.id,
  //     name: product.name,
  //     basePrice: Number(product.price),
  //     imageUrl: product.imageUrls[0] ?? null,
  //     quantity: 1,
  //     options: {},
  //     optionDelta: 0,
  //     note: '',
  //   })
  // }

  async function handleSaveSettings(cfg: PosConfig) {
    setPosConfig(cfg)
    await eAPI?.store.set(cfg as unknown as Record<string, unknown>)
    setSettingsOpen(false)
    const [cats, prods, tabs, pay] = await Promise.allSettled([
      fetchCategories(), fetchProducts(), fetchTables(), fetchPaymentConfig(),
    ])
    if (cats.status === 'fulfilled') setCategories(cats.value)
    if (prods.status === 'fulfilled') setProducts(prods.value)
    if (tabs.status === 'fulfilled') setTables(tabs.value)
    if (pay.status === 'fulfilled') setPaymentConfig(pay.value)
  }
}
