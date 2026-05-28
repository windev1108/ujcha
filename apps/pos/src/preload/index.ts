import { contextBridge, ipcRenderer } from 'electron'

// ─── Shared Types ─────────────────────────────────────────────────────────────

type CustomerUpdate =
  | { type: 'idle' }
  | { type: 'cart'; items: CartItem[]; total: number }
  | { type: 'payment'; qrUrl: string; amount: number; bankInfo: BankInfo }
  | { type: 'success'; amount: number }
  | { type: 'ai'; text: string; state: 'speaking' | 'listening' | 'idle' }
  | { type: 'ai-mode'; enabled: boolean; name: string }

interface CartItem {
  name: string
  quantity: number
  price: number
}

interface BankInfo {
  bankCode: string
  accountNumber: string
  accountName: string
}

export type PrinterConnection = 'usb' | 'bluetooth' | 'network'
export type PrinterStatus = 'connected' | 'disconnected' | 'connecting' | 'error'

export interface DiscoveredPrinter {
  id: string
  name: string
  connection: PrinterConnection
  address?: string   // USB path | BT MAC | IP
  status: PrinterStatus
}

export interface BillConfig {
  enabled: boolean
  printerId: string | null
  paperWidth: 58 | 80
  autoPrint: boolean
  copies: number
  showLogo: boolean
  headerText: string
  footerText: string
  showQr: boolean
  address?: string | null
  printerName?: string | null
  typeId?: string
  lineSpacing?: number
  feedAfterCut?: number
}

export interface LabelConfig {
  enabled: boolean
  printerId: string | null
  labelWidth: number
  labelHeight: number
  autoPrint: boolean
  showProductName: boolean
  showPrice: boolean
  showBarcode: boolean
  showNote: boolean
  customText: string
  address?: string | null
  printerName?: string | null
  typeId?: string
  lineSpacing?: number       // ESC 3 n, default 24
  feedAfterCut?: number      // feed lines sau mỗi label, default 2
  paddingTop?: number        // blank lines trên, default 0
  paddingBottom?: number     // blank lines dưới, default 0
}

// ─── AI Agent Types ───────────────────────────────────────────────────────────

interface AiCartItem {
  productId: string
  name: string
  basePrice: number
  imageUrl: string | null
  quantity: number
  options: Record<string, string>
  optionDetails: { group: string; label: string; priceDelta: number }[]
  optionDelta: number
  extras: { id: string; name: string; price: number }[]
  note: string
}

// ─── API Bridge ───────────────────────────────────────────────────────────────

const electronAPI = {
  store: {
    get: (): Promise<Record<string, unknown>> =>
      ipcRenderer.invoke('store:get'),
    set: (data: Record<string, unknown>): Promise<void> =>
      ipcRenderer.invoke('store:set', data),
  },

  tts: {
    speak: (text: string): Promise<ArrayBuffer | null> =>
      ipcRenderer.invoke('tts:speak', text),
    getConfig: (): Promise<Record<string, unknown>> =>
      ipcRenderer.invoke('tts:getConfig'),
    setConfig: (cfg: Record<string, unknown>): Promise<void> =>
      ipcRenderer.invoke('tts:setConfig', cfg),
  },

  customer: {
    update: (data: CustomerUpdate): void =>
      ipcRenderer.send('customer:update', data),
    toggle: (show: boolean): Promise<void> =>
      ipcRenderer.invoke('customer:toggle', show),
    onUpdate: (cb: (data: CustomerUpdate) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: CustomerUpdate) => cb(data)
      ipcRenderer.on('customer:update', handler)
      return () => ipcRenderer.removeListener('customer:update', handler)
    },
  },

  shell: {
    open: (url: string): Promise<void> =>
      ipcRenderer.invoke('shell:open', url),
  },

  // ── Printer ────────────────────────────────────────────────────────────────
  printer: {
    /** Quét toàn bộ máy in USB, Bluetooth, Network khả dụng */
    discover: (): Promise<DiscoveredPrinter[]> =>
      ipcRenderer.invoke('printer:discover'),

    /** Kết nối tới máy in theo id */
    connect: (id: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('printer:connect', id),

    /** Ngắt kết nối máy in */
    disconnect: (id: string): Promise<void> =>
      ipcRenderer.invoke('printer:disconnect', id),

    /**
     * In thử để kiểm tra máy in.
     * type = 'bill'  → in mẫu hóa đơn
     * type = 'label' → in mẫu nhãn dán
     */
    testPrint: (id: string, type: 'bill' | 'label'): Promise<void> =>
      ipcRenderer.invoke('printer:testPrint', id, type),

    /**
     * In hóa đơn thật cho một đơn hàng.
     * html = nội dung HTML từ buildReceiptDocumentHtml()
     */
    printBill: (
      printerId: string,
      html: string,
      copies: number,
      cfg?: BillConfig,
    ): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('printer:printBill', printerId, html, copies, cfg),

    printLabels: (
      printerId: string,
      labels: string[],
      cfg?: LabelConfig,
    ): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('printer:printLabels', printerId, labels, cfg),

    /** Lắng nghe sự kiện trạng thái máy in thay đổi từ main process */
    onStatusChange: (
      cb: (printer: Pick<DiscoveredPrinter, 'id' | 'status'>) => void,
    ): (() => void) => {
      const handler = (
        _: Electron.IpcRendererEvent,
        data: Pick<DiscoveredPrinter, 'id' | 'status'>,
      ) => cb(data)
      ipcRenderer.on('printer:statusChange', handler)
      return () => ipcRenderer.removeListener('printer:statusChange', handler)
    },
    getSaved: (): Promise<DiscoveredPrinter[]> =>
      ipcRenderer.invoke('printer:getSaved'),
    scanCom: (): Promise<{ com: string; name: string; isBluetooth: boolean }[]> =>
      ipcRenderer.invoke('printer:scanCom'),
    testPrintByAddress: (
      address: string,
      type: 'bill' | 'label',
      printerName: string,
    ): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('printer:testPrintByAddress', address, type, printerName),

    printBillByAddress: (
      address: string,
      printerName: string,
      html: string,
      copies: number,
      cfg?: BillConfig,
    ): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('printer:printBillByAddress', address, printerName, html, copies, cfg),

    printLabelsByAddress: (
      address: string,
      printerName: string,
      labels: string[],
      cfg?: LabelConfig,
    ): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('printer:printLabelsByAddress', address, printerName, labels, cfg),
    printRawLabelsByAddress: (
      address: string,
      printerName: string,
      rawLabels: number[][],
      cfg?: LabelConfig,
    ): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('printer:printRawLabelsByAddress', address, printerName, rawLabels, cfg),
  },

  // ── GrabFood ────────────────────────────────────────────────────────────────
  grab: {
    getStatus: (): Promise<{
      polling: boolean
      lastPollTime: string | null
      lastPollStatus: 'ok' | 'auth_error' | 'error' | 'idle'
      hasAuth: boolean
      merchantName: string | null
      pollIntervalMs: number
    }> => ipcRenderer.invoke('grab:getStatus'),

    connect: (username: string, password: string, otp?: string): Promise<{
      ok: boolean
      connected: boolean
      needsOtp?: boolean
      stores: { storeId: string; storeName: string }[]
      error?: string
    }> => ipcRenderer.invoke('grab:connect', username, password, otp),

    sync: (): Promise<{
      ok: boolean
      connected: boolean
      stores: { storeId: string; storeName: string }[]
      connectors?: { connectorId: string; connectorLoginKey?: string; merchantName?: string }[]
      error?: string
    }> => ipcRenderer.invoke('grab:sync'),

    webLogin: (): Promise<{ ok: boolean; merchantName?: string; error?: string }> =>
      ipcRenderer.invoke('grab:webLogin'),

    reset: (): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('grab:reset'),

    /** Lấy danh sách đơn từ GrabFood daily-pagination (không qua DB) */
    listOrders: (startDate?: string, endDate?: string, pageIndex?: number): Promise<{
      ok: boolean
      orders: Array<{
        ID: string
        deliveryStatus: string
        createdAt: string
        bookingCode: string
        displayID: string
        orderEarningsInMinorUnit: number
        [key: string]: unknown
      }>
      hasMore: boolean
      pageIndex: number
      error?: string
    }> => ipcRenderer.invoke('grab:listOrders', startDate, endDate, pageIndex ?? 0),

    /** Lấy live orders theo PageType (PreparingV2 / UpcomingV2 / …) */
    listLiveOrders: (pageType: string): Promise<{
      ok: boolean
      orders: Array<{
        orderID: string
        displayID: string
        state: string
        orderValue: string
        eater: { ID: number; name: string }
        itemInfo: { count: number; items: Array<{ itemID?: string; name: string; quantity: number; comment?: string }> }
        times: { createdAt: string; estimatedPickUpTime?: string }
        preparationTaskID?: string
        labels?: { isRead: boolean; acceptedViaAA?: boolean }
        [key: string]: unknown
      }>
      merchantID?: string
      error?: string
    }> => ipcRenderer.invoke('grab:listLiveOrders', pageType),

    /** Lấy danh sách đơn đang chuẩn bị từ orders-pagination v4 (realtime) */
    listPreparingOrders: (): Promise<{
      ok: boolean
      orders: Array<{
        orderID: string
        displayID: string
        state: string
        orderValue: string
        eater: { ID: number; name: string }
        itemInfo: { count: number; items: Array<{ itemID?: string; name: string; quantity: number; comment?: string }> }
        times: { createdAt: string; estimatedPickUpTime?: string }
        preparationTaskID?: string
        labels?: { isRead: boolean; acceptedViaAA?: boolean }
        [key: string]: unknown
      }>
      merchantID?: string
      error?: string
    }> => ipcRenderer.invoke('grab:listPreparingOrders'),

    /** Lấy chi tiết đơn từ food/merchant/v3/orders/{id} */
    getOrder: (id: string): Promise<{ ok: boolean; order?: Record<string, unknown>; error?: string }> =>
      ipcRenderer.invoke('grab:getOrder', id),

    /** Đánh dấu đơn hàng sẵn sàng để shipper đến lấy */
    markOrderReady: (orderID: string, preparationTaskID?: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('grab:markOrderReady', orderID, preparationTaskID),

    /** Đặt Merchant ID thủ công (lấy từ URL grab merchant portal) */
    setMerchantId: (id: string): Promise<void> =>
      ipcRenderer.invoke('grab:setMerchantId', id),

    /** Sync doanh thu ngày (từ merchant-report-summary) vào backend */
    syncRevenue: (date?: string): Promise<{ ok: boolean; data?: unknown; error?: string }> =>
      ipcRenderer.invoke('grab:syncRevenue', date),

    /** Lắng nghe sự kiện đơn mới từ GrabFood (phát hiện qua polling) */
    onNewOrder: (cb: (id: string) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, id: string) => cb(id)
      ipcRenderer.on('grab:newOrder', handler)
      return () => ipcRenderer.removeListener('grab:newOrder', handler)
    },

    setPollInterval: (ms: number): Promise<void> =>
      ipcRenderer.invoke('grab:setPollInterval', ms),
  },
  // ── ShopeeFood Partner API ──────────────────────────────────────────────────
  spfPartner: {
    getStatus: (): Promise<{
      connected: boolean
      polling: boolean
      restaurantId: string | null
      restaurantName: string | null
      entityId: string | null
      savedAt: string | null
      pollIntervalMs: number
    }> => ipcRenderer.invoke('spfPartner:getStatus'),

    webLogin: (): Promise<{ ok: boolean; restaurantId?: string; error?: string }> =>
      ipcRenderer.invoke('spfPartner:webLogin'),

    reset: (): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('spfPartner:reset'),

    getTransactions: (
      restaurantId: string,
      fromDate: string,
      toDate: string,
    ): Promise<{
      ok: boolean
      data?: {
        total_amount: { value: number; text: string; unit: string }
        transactions: Array<{
          status: number
          amount: string
          create_time: string
          order_code: string
          order_id: number
          type: number
          transaction_id: string
        }>
      }
      error?: string
    }> => ipcRenderer.invoke('spfPartner:getTransactions', restaurantId, fromDate, toDate),

    setPollInterval: (ms: number): Promise<void> =>
      ipcRenderer.invoke('spfPartner:setPollInterval', ms),

    getRestaurantList: (): Promise<Array<{
      store_id: number
      restaurant_id: number
      delivery_id: number
      name: string
      foody_service_id: number
    }>> => ipcRenderer.invoke('spfPartner:getRestaurantList'),

    onNewOrder: (cb: (orderCode: string) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, code: string) => cb(code)
      ipcRenderer.on('spfPartner:newOrder', handler)
      return () => ipcRenderer.removeListener('spfPartner:newOrder', handler)
    },
  },

  font: {
    getBase64: () => ipcRenderer.invoke('font:getBase64'),
  },

  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  },

  // ── Auto-updater ────────────────────────────────────────────────────────────
  updater: {
    check: (): void => ipcRenderer.send('updater:check'),
    startDownload: (url: string, version: string): void =>
      ipcRenderer.send('updater:startDownload', url, version),
    install: (): void => ipcRenderer.send('updater:install'),
    openDownload: (url: string): void => ipcRenderer.send('updater:openDownload', url),

    onAvailable: (cb: (info: { version: string; downloadUrl: string; releaseNotes: string | null }) => void): (() => void) => {
      const h = (_: Electron.IpcRendererEvent, info: { version: string; downloadUrl: string; releaseNotes: string | null }) => cb(info)
      ipcRenderer.on('updater:available', h)
      return () => ipcRenderer.removeListener('updater:available', h)
    },
    onProgress: (cb: (pct: number) => void): (() => void) => {
      const h = (_: Electron.IpcRendererEvent, pct: number) => cb(pct)
      ipcRenderer.on('updater:progress', h)
      return () => ipcRenderer.removeListener('updater:progress', h)
    },
    onDownloaded: (cb: () => void): (() => void) => {
      const h = () => cb()
      ipcRenderer.on('updater:downloaded', h)
      return () => ipcRenderer.removeListener('updater:downloaded', h)
    },
    onDownloadError: (cb: (msg: string) => void): (() => void) => {
      const h = (_: Electron.IpcRendererEvent, msg: string) => cb(msg)
      ipcRenderer.on('updater:downloadError', h)
      return () => ipcRenderer.removeListener('updater:downloadError', h)
    },
    onInstalling: (cb: () => void): (() => void) => {
      const h = () => cb()
      ipcRenderer.on('updater:installing', h)
      return () => ipcRenderer.removeListener('updater:installing', h)
    },
  },

  // ── AI Order Agent ──────────────────────────────────────────────────────────
  ai: {
    /** Send a text message to the AI agent (streaming response via onChunk/onDone events) */
    chat: (sessionId: string, message: string, accessToken: string): Promise<void> =>
      ipcRenderer.invoke('ai:chat', sessionId, message, accessToken),

    /** Transcribe an audio ArrayBuffer using Viettel STT */
    transcribe: (audioBuffer: ArrayBuffer): Promise<string | null> =>
      ipcRenderer.invoke('ai:transcribe', audioBuffer),

    /** Clear conversation history */
    clearSession: (sessionId: string): Promise<void> =>
      ipcRenderer.invoke('ai:clearSession', sessionId),

    /** Invalidate menu cache after product changes */
    invalidateMenu: (): Promise<void> =>
      ipcRenderer.invoke('ai:invalidateMenu'),

    /** Check if API key is available in .env */
    hasKey: (): Promise<boolean> =>
      ipcRenderer.invoke('ai:hasKey'),

    /** Get AI app config (enabled, name) */
    getAppConfig: (): Promise<{ enabled: boolean; name: string }> =>
      ipcRenderer.invoke('ai:getAppConfig'),

    /** Save AI app config */
    setAppConfig: (config: { enabled?: boolean; name?: string; sttCorrections?: Record<string, string> }): Promise<void> =>
      ipcRenderer.invoke('ai:setAppConfig', config),

    /** Get raw AI config (API key, model) */
    getConfig: (): Promise<{ anthropicApiKey: string; model?: string } | null> =>
      ipcRenderer.invoke('ai:getConfig'),

    /** Save raw AI config */
    setConfig: (config: { anthropicApiKey: string; model?: string }): Promise<void> =>
      ipcRenderer.invoke('ai:setConfig', config),

    /** Streaming text chunk from AI */
    onChunk: (cb: (data: { sessionId: string; text: string }) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { sessionId: string; text: string }) => cb(data)
      ipcRenderer.on('ai:chunk', handler)
      return () => ipcRenderer.removeListener('ai:chunk', handler)
    },

    /** AI finished responding */
    onDone: (cb: (data: { sessionId: string }) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { sessionId: string }) => cb(data)
      ipcRenderer.on('ai:done', handler)
      return () => ipcRenderer.removeListener('ai:done', handler)
    },

    /** AI error */
    onError: (cb: (data: { sessionId: string; error: string }) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { sessionId: string; error: string }) => cb(data)
      ipcRenderer.on('ai:error', handler)
      return () => ipcRenderer.removeListener('ai:error', handler)
    },

    /** AI wants to add items to cart */
    onAddToCart: (cb: (items: AiCartItem[]) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, items: AiCartItem[]) => cb(items)
      ipcRenderer.on('ai:addToCart', handler)
      return () => ipcRenderer.removeListener('ai:addToCart', handler)
    },

    /** AI wants to update quantity of an existing cart item (qty=0 means remove) */
    onUpdateCartItem: (cb: (data: { position: number; qty: number }) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { position: number; qty: number }) => cb(data)
      ipcRenderer.on('ai:updateCartItem', handler)
      return () => ipcRenderer.removeListener('ai:updateCartItem', handler)
    },

    /** AI triggers checkout after payment method confirmed */
    onCheckout: (cb: (data: { sessionId: string; paymentMethod: 'cash' | 'transfer' }) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { sessionId: string; paymentMethod: 'cash' | 'transfer' }) => cb(data)
      ipcRenderer.on('ai:checkout', handler)
      return () => ipcRenderer.removeListener('ai:checkout', handler)
    },
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type ElectronAPI = typeof electronAPI