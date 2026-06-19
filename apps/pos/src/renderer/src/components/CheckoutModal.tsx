import { useEffect, useRef, useState } from 'react'
import { Banknote, QrCode, X, CheckCircle2, Loader2, AlertCircle, Printer, Tag, Phone, Star } from 'lucide-react'
import { usePosStore } from '../store/pos-store'
import { API_URL, createOrder, lookupCustomer, type CustomerLookupResult } from '../api'
import { DEFAULT_BILL_CONFIG, DEFAULT_LABEL_CONFIG, type AdminOrder } from '../types/common'
import { getSocket } from '../socket'
import { buildReceiptDocumentHtml, buildOrderLabels, buildKunLoyaltyQrUrl } from '@/lib/receipt-shared'
import { KEYS, loadLocal } from '@/lib/local-storage'
import { BillConfig, LabelConfig } from '../../../preload'
import { getFontBase64 } from '@/lib/font-cache'

// ─── Electron bridge ──────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const eAPI = (window as any).electronAPI as import('../../../preload').ElectronAPI | undefined

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString('vi-VN') + 'đ' }

async function fetchTtsBuffer(text: string): Promise<ArrayBuffer | null> {
  try {
    const buf = await eAPI?.tts.speak(text)
    return buf ?? null
  } catch {
    return null
  }
}

function playBuffer(buf: ArrayBuffer): void {
  try {
    const blob = new Blob([buf], { type: 'audio/mpeg' })
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true })
    audio.addEventListener('error', () => URL.revokeObjectURL(url), { once: true })
    audio.play().catch(() => URL.revokeObjectURL(url))
  } catch { /* ignore */ }
}

function buildQrUrl(config: { bankCode: string; accountNumber: string }, amount: number, des: string) {
  const params = new URLSearchParams({
    bank: config.bankCode, acc: config.accountNumber,
    amount: String(Math.round(amount)), des, template: 'compact',
  })
  return `https://qr.sepay.vn/img?${params.toString()}`
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'cash' | 'qr'
type Phase = 'input' | 'pending' | 'success'
type PrintStatus = 'idle' | 'printing' | 'done' | 'error'
type SearchState = 'idle' | 'searching' | 'found' | 'not_found'

// ─── Customer lookup panel ────────────────────────────────────────────────────
function CustomerPanel({
  phone,
  onPhoneChange,
  searchState,
  searchResults,
  customer,
  onSelect,
  onClear,
}: {
  phone: string
  onPhoneChange: (v: string) => void
  searchState: SearchState
  searchResults: CustomerLookupResult[]
  customer: CustomerLookupResult | null
  onSelect: (c: CustomerLookupResult) => void
  onClear: () => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [dismissed, setDismissed] = useState(false)

  // Reset dismissed whenever a new search round starts
  useEffect(() => { setDismissed(false) }, [searchResults])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setDismissed(true)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const dropdownOpen = !dismissed && searchState === 'found' && !customer && searchResults.length > 0

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500">
        Tích điểm khách hàng <span className="font-normal text-gray-400">(tùy chọn)</span>
      </p>

      <div ref={wrapRef} className="relative">
        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 z-10" />
        <input
          type="tel"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          onFocus={() => setDismissed(false)}
          placeholder="Nhập SĐT để tìm khách…"
          className="h-10 w-full rounded-xl border border-gray-200 pl-8 pr-8 text-sm focus:border-brand focus:outline-none"
          autoComplete="off"
        />
        {searchState === 'searching' && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 animate-spin text-gray-400" />
        )}
        {phone && searchState !== 'searching' && (
          <button
            onMouseDown={(e) => { e.preventDefault(); onClear() }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 flex size-5 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
          >
            <X className="size-3 text-gray-500" />
          </button>
        )}

        {/* Autocomplete dropdown */}
        {dropdownOpen && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            {searchResults.map((r) => (
              <button
                key={r.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onSelect(r)
                  setDismissed(true)
                }}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 border-b border-gray-50 last:border-0"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                  {r.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{r.name}</p>
                  <p className="text-[11px] text-gray-500">{r.phone ?? r.email}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Star className="size-3 text-amber-400 fill-amber-400" />
                    <span className="text-xs font-bold text-brand tabular-nums">
                      {r.pointBalance.toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <p className="text-[9px] text-gray-400">điểm</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected customer card */}
      {customer && (
        <div className="flex items-center gap-2.5 rounded-xl border border-green-100 bg-green-50 px-3 py-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">{customer.name}</p>
            <p className="text-[11px] text-gray-500">{customer.phone ?? customer.email}</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="flex items-center justify-end gap-1">
              <Star className="size-3 text-amber-400 fill-amber-400" />
              <p className="text-sm font-bold text-brand tabular-nums">
                {customer.pointBalance.toLocaleString('vi-VN')}
              </p>
            </div>
            <p className="text-[10px] text-gray-400">điểm hiện có</p>
          </div>
        </div>
      )}

      {searchState === 'not_found' && !customer && (
        <p className="px-1 text-xs text-gray-400">Không tìm thấy khách với SĐT này</p>
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
export function CheckoutModal({ onClose, initialTab, autoConfirm, onOrderComplete, onOrderCreated }: {
  onClose: () => void
  initialTab?: Tab
  autoConfirm?: boolean
  onOrderComplete?: () => void
  onOrderCreated?: (orderId: string) => void
}) {
  const cart = usePosStore((s) => s.cart)
  const cartTotal = usePosStore((s) => s.cartTotal)
  const selectedTableId = usePosStore((s) => s.selectedTableId)
  const paymentConfig = usePosStore((s) => s.paymentConfig)
  const posConfig = usePosStore((s) => s.posConfig)
  const clearCart = usePosStore((s) => s.clearCart)

  const total = cartTotal()
  const [tab, setTab] = useState<Tab>(initialTab ?? 'cash')
  const [cashInput, setCashInput] = useState('')
  const [phase, setPhase] = useState<Phase>('input')

  // Sync tab when AI changes payment method (only while still in input phase)
  useEffect(() => {
    if (initialTab && phase === 'input') setTab(initialTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [order, setOrder] = useState<AdminOrder | null>(null)

  const [labelPrintState, setLabelPrintState] = useState<PrintStatus>('idle')
  const [billPrintState, setBillPrintState] = useState<PrintStatus>('idle')

  const [billCfg, setBillCfg] = useState<BillConfig>(DEFAULT_BILL_CONFIG)
  const [labelCfg, setLabelCfg] = useState<LabelConfig>(DEFAULT_LABEL_CONFIG)

  // ── Customer loyalty state ────────────────────────────────────────────────
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerSearchState, setCustomerSearchState] = useState<SearchState>('idle')
  const [searchResults, setSearchResults] = useState<CustomerLookupResult[]>([])
  const [linkedCustomer, setLinkedCustomer] = useState<CustomerLookupResult | null>(null)

  useEffect(() => {
    const raw = customerPhone.replace(/\D/g, '')
    if (raw.length < 8) {
      setCustomerSearchState('idle')
      setSearchResults([])
      setLinkedCustomer(null)
      return
    }
    setCustomerSearchState('searching')
    const tid = setTimeout(async () => {
      try {
        const results = await lookupCustomer(raw)
        if (results.length > 0) {
          setSearchResults(results)
          setCustomerSearchState('found')
        } else {
          setSearchResults([])
          setLinkedCustomer(null)
          setCustomerSearchState('not_found')
        }
      } catch {
        setSearchResults([])
        setLinkedCustomer(null)
        setCustomerSearchState('idle')
      }
    }, 400)
    return () => clearTimeout(tid)
  }, [customerPhone])

  function clearCustomer() {
    setCustomerPhone('')
    setCustomerSearchState('idle')
    setSearchResults([])
    setLinkedCustomer(null)
  }
  // ─────────────────────────────────────────────────────────────────────────

  const socketHandlerRef = useRef<((p: unknown) => void) | null>(null)
  const submittedRef = useRef(false)
  const billCfgRef = useRef(billCfg)
  const labelCfgRef = useRef(labelCfg)
  const ttsBufferRef = useRef<ArrayBuffer | null>(null)
  useEffect(() => { billCfgRef.current = billCfg }, [billCfg])
  useEffect(() => { labelCfgRef.current = labelCfg }, [labelCfg])

  useEffect(() => {
    const b = loadLocal<BillConfig>(KEYS.bill, DEFAULT_BILL_CONFIG)
    const l = loadLocal<LabelConfig>(KEYS.label, DEFAULT_LABEL_CONFIG)
    setBillCfg(b); setLabelCfg(l)
    billCfgRef.current = b; labelCfgRef.current = l
  }, [])

  // Pre-fetch TTS for QR/transfer payment only (cash has no TTS announcement)
  useEffect(() => {
    if (initialTab === 'cash') return
    const ttsText = `Đã nhận ${total.toLocaleString('vi-VN')} đồng. Cảm ơn quý khách! Hẹn gặp lại.`
    void fetchTtsBuffer(ttsText).then(buf => { ttsBufferRef.current = buf })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      if (socketHandlerRef.current) getSocket(API_URL).off('order:paid', socketHandlerRef.current)
    }
  }, [])

  // Auto-run checkout when AI confirmed payment method
  useEffect(() => {
    if (!autoConfirm) return
    if (submittedRef.current) return
    submittedRef.current = true
    if (tab === 'cash') void handleCashConfirm()
    else void handleQrCheckout()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-close success modal when triggered by AI (so next order can start immediately)
  useEffect(() => {
    if (phase !== 'success' || !autoConfirm) return
    const t = setTimeout(() => handleSuccess(), 3000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const cashReceived = Number(cashInput.replace(/\D/g, ''))
  const change = cashReceived >= total ? cashReceived - total : 0
  const QUICK_CASH = [50000, 100000, 200000, 500000].filter((v) => v >= total).slice(0, 3)
  if (!QUICK_CASH.length) QUICK_CASH.push(Math.ceil(total / 50000) * 50000)

  function buildOrderBody(paymentStatus: 'paid' | 'pending') {
    return {
      type: selectedTableId ? 'table' : 'pickup',
      tableId: selectedTableId ?? undefined,
      paymentStatus,
      pickupTime: new Date().toISOString(),
      paymentType: tab === 'cash' ? 'cash' : 'bank_transfer',
      ...(linkedCustomer ? { userId: linkedCustomer.id } : {}),
      items: cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.basePrice + item.optionDelta + (item.extras ?? []).reduce((s, e) => s + (e.price ?? 0), 0),
        note: item.note || undefined,
        ...(Object.keys(item.options).length ? { options: item.options } : {}),
        ...(item.extras?.length
          ? { extras: item.extras.map(e => ({ toppingId: e.id })) }
          : {}),
      }))
    }
  }

  // ── Print helpers ────────────────────────────────────────────────────────────

  async function printLabelsOnOrderCreated(o: AdminOrder) {
    const l = labelCfgRef.current
    if (!l.enabled || !l.autoPrint) return
    const address = l.address || l.printerId?.replace('manual-', '')
    const printerName = l.printerName || address
    if (!address) return
    const fontBase64 = await getFontBase64()

    setLabelPrintState('printing')
    const allLabels = buildOrderLabels(o, {
      labelWidth: l.labelWidth,
      showProductName: l.showProductName,
      showPrice: l.showPrice,
      showNote: l.showNote,
      customText: l.customText,
      lineSpacing: l.lineSpacing,
      feedAfterCut: l.feedAfterCut,
      paddingTop: l.paddingTop,
      paddingBottom: l.paddingBottom,
    }, fontBase64)
    if (!allLabels.length) { setLabelPrintState('idle'); return }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (eAPI?.printer as any)?.printLabelsByAddress(address, printerName, allLabels, l) ?? { ok: true }
      setLabelPrintState(res?.ok === false ? 'error' : 'done')
    } catch {
      setLabelPrintState('error')
    }
  }

  async function printBillAfterPayment(o: AdminOrder) {
    const b = billCfgRef.current
    if (!b.enabled || !b.autoPrint) return
    const address = b.address || b.printerId?.replace('manual-', '')
    const printerName = b.printerName || address
    if (!address) return
    const fontBase64 = await getFontBase64()

    setBillPrintState('printing')
    const loyaltyQrUrl = (o.paymentCode && (o.type === 'pickup' || o.type === 'table' || !o.userId))
      ? buildKunLoyaltyQrUrl(o.paymentCode) : undefined
    const html = buildReceiptDocumentHtml(o, loyaltyQrUrl, null, fontBase64)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (eAPI?.printer as any)?.printBillByAddress(address, printerName, html, b.copies, b) ?? { ok: true }
      setBillPrintState(res?.ok === false ? 'error' : 'done')
    } catch {
      setBillPrintState('error')
    }
  }

  function onPaymentSuccess(o: AdminOrder, paidAmount: number, playTts: boolean) {
    eAPI?.customer.update({ type: 'success', amount: paidAmount })
    setPhase('success')
    void printBillAfterPayment(o)

    if (!playTts) return

    const ttsText = `Đã nhận ${paidAmount.toLocaleString('vi-VN')} đồng. Cảm ơn quý khách! Hẹn gặp lại.`
    if (ttsBufferRef.current && paidAmount === total) {
      playBuffer(ttsBufferRef.current)
    } else {
      void fetchTtsBuffer(ttsText).then(buf => { if (buf) playBuffer(buf) })
    }
  }

  async function handleManualPrint(type: 'bill' | 'label') {
    if (!order) return
    if (type === 'bill') {
      const address = billCfg.address || billCfg.printerId?.replace('manual-', '')
      const printerName = billCfg.printerName || address
      if (!address) return
      const fontBase64 = await getFontBase64()
      setBillPrintState('printing')
      const loyaltyQrUrl = (order.paymentCode && (order.type === 'pickup' || order.type === 'table' || !order.userId))
        ? buildKunLoyaltyQrUrl(order.paymentCode) : undefined
      const html = buildReceiptDocumentHtml(order, loyaltyQrUrl, null, fontBase64)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await (eAPI?.printer as any)?.printBillByAddress(address, printerName, html, billCfg.copies, billCfg) ?? { ok: true }
        setBillPrintState(res?.ok === false ? 'error' : 'done')
      } catch { setBillPrintState('error') }
    } else {
      const address = labelCfg.address || labelCfg.printerId?.replace('manual-', '')
      const printerName = labelCfg.printerName || address
      if (!address) return
      const fontBase64 = await getFontBase64()
      setLabelPrintState('printing')
      const allLabels = buildOrderLabels(order, {
        labelWidth: labelCfg.labelWidth,
        showProductName: labelCfg.showProductName,
        showPrice: labelCfg.showPrice,
        showNote: labelCfg.showNote,
        customText: labelCfg.customText,
        lineSpacing: labelCfg.lineSpacing,
        feedAfterCut: labelCfg.feedAfterCut,
        paddingTop: labelCfg.paddingTop,
        paddingBottom: labelCfg.paddingBottom,
      }, fontBase64)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await (eAPI?.printer as any)?.printLabelsByAddress(address, printerName, allLabels, labelCfg) ?? { ok: true }
        setLabelPrintState(res?.ok === false ? 'error' : 'done')
      } catch { setLabelPrintState('error') }
    }
  }

  // ── Cash flow ────────────────────────────────────────────────────────────────
  async function handleCashConfirm() {
    setLoading(true); setError('')
    try {
      const o = await createOrder(buildOrderBody('paid'))
      setOrder(o)
      onOrderCreated?.(o.id)
      void printLabelsOnOrderCreated(o)
      onPaymentSuccess(o, total, false)
    } catch {
      setError('Không thể tạo đơn. Thử lại.')
    } finally {
      setLoading(false)
    }
  }

  // ── QR flow ──────────────────────────────────────────────────────────────────
  async function handleQrCheckout() {
    setLoading(true); setError('')
    try {
      const o = await createOrder(buildOrderBody('pending'))
      setOrder(o)
      onOrderCreated?.(o.id)
      void printLabelsOnOrderCreated(o)
      setPhase('pending')

      if (paymentConfig) {
        const qrUrl = buildQrUrl(paymentConfig, total, o.paymentCode)
        eAPI?.customer.update({
          type: 'payment', qrUrl, amount: total,
          bankInfo: { bankCode: paymentConfig.bankCode, accountNumber: paymentConfig.accountNumber, accountName: paymentConfig.accountName },
        })
      }

      const socket = getSocket(API_URL)
      const handler = async (p: { orderId: string; paymentCode: string; transferAmount: number; transactionId: string }) => {
        if (p.orderId !== o.id) return
        socket.off('order:paid', handler)
        socketHandlerRef.current = null
        onPaymentSuccess(o, p.transferAmount, true)
      }
      socketHandlerRef.current = handler as (p: unknown) => void
      socket.on('order:paid', handler)
    } catch {
      setError('Không thể tạo đơn. Thử lại.')
    } finally {
      setLoading(false)
    }
  }

  function handleSuccess() {
    clearCart()
    eAPI?.customer.update({ type: 'idle' })
    onOrderComplete?.()
    onClose()
  }

  const qrUrl = order && paymentConfig ? buildQrUrl(paymentConfig, total, order.paymentCode) : null
  const hasBillPrinter = billCfg.enabled && !!(billCfg.address || billCfg.printerId)
  const hasLabelPrinter = labelCfg.enabled && !!(labelCfg.address || labelCfg.printerId)

  // ── Success screen ───────────────────────────────────────────────────────────
  if (phase === 'success') {
    return (
      <ModalWrap onClose={handleSuccess}>
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="size-10 text-green-600" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-gray-900">Thanh toán thành công!</h2>
            <p className="mt-1 text-gray-500">{order?.orderRef}</p>
            <p className="mt-3 text-3xl font-black text-brand">{fmt(total)}</p>
            {tab === 'cash' && cashReceived > 0 && (
              <p className="mt-2 text-sm text-gray-500">
                Tiền thối: <strong className="text-green-600">{fmt(change)}</strong>
              </p>
            )}
            {linkedCustomer && (
              <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-amber-600">
                <Star className="size-3.5" />
                Đã tích điểm cho <strong>{linkedCustomer.name}</strong>
              </p>
            )}
          </div>

          {(hasBillPrinter || hasLabelPrinter) && (
            <div className="w-full space-y-2">
              {hasLabelPrinter && (
                <PrintRow icon={<Tag className="size-4" />} label="In nhãn dán" status={labelPrintState} onPrint={() => void handleManualPrint('label')} />
              )}
              {hasBillPrinter && (
                <PrintRow icon={<Printer className="size-4" />} label="In hóa đơn" status={billPrintState} onPrint={() => void handleManualPrint('bill')} />
              )}
            </div>
          )}

          <button onClick={handleSuccess} className="mt-2 h-12 w-48 rounded-xl bg-brand font-bold text-white hover:bg-brand/90">
            {autoConfirm ? 'Đơn mới (tự đóng...)' : 'Đơn mới'}
          </button>
        </div>
      </ModalWrap>
    )
  }

  const showPrintStatusWhilePending = phase === 'pending' && hasLabelPrinter

  return (
    <ModalWrap onClose={onClose}>
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
        {(['cash', 'qr'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { if (phase === 'input') setTab(t) }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition ${tab === t ? 'bg-white shadow text-brand' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'cash' ? <Banknote className="size-4" /> : <QrCode className="size-4" />}
            {t === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-brand/5 px-6 py-4 text-center">
        <p className="text-sm text-gray-500">Tổng thanh toán</p>
        <p className="mt-1 text-4xl font-black text-brand">{fmt(total)}</p>
      </div>

      {/* Customer loyalty lookup — only during input phase, not AI auto-confirm */}
      {phase === 'input' && !autoConfirm && (
        <CustomerPanel
          phone={customerPhone}
          onPhoneChange={setCustomerPhone}
          searchState={customerSearchState}
          searchResults={searchResults}
          customer={linkedCustomer}
          onSelect={setLinkedCustomer}
          onClear={clearCustomer}
        />
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="size-4" /> {error}
        </div>
      )}

      {showPrintStatusWhilePending && (
        <PrintRow icon={<Tag className="size-4" />} label="In nhãn dán" status={labelPrintState} onPrint={() => void handleManualPrint('label')} />
      )}

      {tab === 'cash' && phase === 'input' && (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-500">Tiền khách đưa</label>
            <input
              type="text"
              value={cashInput ? Number(cashInput.replace(/\D/g, '')).toLocaleString('vi-VN') : ''}
              onChange={(e) => setCashInput(e.target.value.replace(/\D/g, ''))}
              placeholder="Nhập số tiền…"
              className="h-12 w-full rounded-xl border border-gray-200 px-4 text-right text-lg font-bold focus:border-brand focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            {QUICK_CASH.map((v) => (
              <button key={v} onClick={() => setCashInput(String(v))} className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-semibold text-gray-700 hover:border-brand hover:text-brand">
                {v.toLocaleString('vi-VN')}
              </button>
            ))}
          </div>
          {cashReceived >= total && (
            <div className="flex items-center justify-between rounded-xl bg-green-50 px-4 py-3">
              <span className="text-sm text-green-700">Tiền thối</span>
              <span className="text-lg font-black text-green-700">{fmt(change)}</span>
            </div>
          )}
          <button
            onClick={() => void handleCashConfirm()}
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand font-bold text-white hover:bg-brand/90 disabled:opacity-60"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-5" />}
            {loading ? 'Đang xử lý…' : 'Xác nhận thanh toán'}
          </button>
        </div>
      )}

      {tab === 'qr' && (
        <div className="space-y-4">
          {phase === 'input' && (
            <>
              {!paymentConfig?.isEnabled ? (
                <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Chưa cấu hình thanh toán QR. Vào web-admin → Thanh toán để thiết lập.
                </div>
              ) : (
                <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  Tạo đơn và hiển thị QR để khách quét thanh toán.
                </div>
              )}
              <button
                onClick={() => void handleQrCheckout()}
                disabled={loading || !paymentConfig?.isEnabled}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand font-bold text-white hover:bg-brand/90 disabled:opacity-60"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-5" />}
                {loading ? 'Đang tạo đơn…' : 'Tạo QR thanh toán'}
              </button>
            </>
          )}
          {phase === 'pending' && qrUrl && (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <img src={qrUrl} alt="QR thanh toán" className="h-48 w-48 rounded-lg" />
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Quét QR để thanh toán</p>
                {paymentConfig && (
                  <p className="mt-1 text-xs text-gray-400">
                    {paymentConfig.bankCode} · {paymentConfig.accountNumber}
                    {paymentConfig.accountName ? ` · ${paymentConfig.accountName}` : ''}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <Loader2 className="size-4 animate-spin" />
                Đang chờ thanh toán…
              </div>
            </div>
          )}
        </div>
      )}
    </ModalWrap>
  )
}

// ─── Print row ────────────────────────────────────────────────────────────────
function PrintRow({ icon, label, status, onPrint }: { icon: React.ReactNode; label: string; status: PrintStatus; onPrint: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
      <div className="flex items-center gap-2 text-sm text-gray-700">{icon}<span>{label}</span></div>
      <div className="flex items-center gap-2">
        {status === 'idle' && <button onClick={onPrint} className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600 hover:border-brand hover:text-brand">In ngay</button>}
        {status === 'printing' && <span className="flex items-center gap-1 text-xs text-amber-600"><Loader2 className="size-3.5 animate-spin" /> Đang in…</span>}
        {status === 'done' && <button onClick={onPrint} className="flex items-center gap-1 text-xs font-semibold text-green-600 hover:text-green-700"><CheckCircle2 className="size-3.5" /> Đã in · In lại</button>}
        {status === 'error' && <button onClick={onPrint} className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"><AlertCircle className="size-3.5" /> Thử lại</button>}
      </div>
    </div>
  )
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function ModalWrap({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-gray-900">Thanh toán</h2>
          <button onClick={onClose} className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
