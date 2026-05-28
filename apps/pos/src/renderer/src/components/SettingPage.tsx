import {
    ArrowLeft, User, Printer, Tag, ChevronRight,
    Wifi, Bluetooth, Usb, Search, CheckCircle2,
    XCircle, Loader2, Save, FlaskConical, Trash2,
    Mail, Shield, FileText, RefreshCw, LogOut,
    ShoppingBagIcon, HandshakeIcon, Bot, Download, Volume2,
} from 'lucide-react'
import grabFoodLogo from '../assets/grab-food.png'
import shopeeFoodLogo from '../assets/shopee-food.png'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { PosConfig } from '../types/common'
import { KEYS, loadLocal, saveLocal } from '@/lib/local-storage'
import type { BillConfig, LabelConfig } from '../../../preload/index'

// ─── Electron bridge ──────────────────────────────────────────────────────────
const eAPI = (window as unknown as {
    electronAPI?: import('../../../preload/index').ElectronAPI
}).electronAPI

// ─── Types ────────────────────────────────────────────────────────────────────
type Section = 'account' | 'printer-bill' | 'printer-label' | 'partners' | 'ai'

type PrinterTypeId =
    | 'xprinter-bluetooth'
    | 'xprinter-wifi'
    | 'xprinter-usb'
    | 'epson-wifi'
    | 'epson-bluetooth'
    | 'sunmi-bluetooth'
    | 'other-wifi'

interface PrinterTypeOption {
    id: PrinterTypeId
    label: string
    connection: 'bluetooth' | 'network' | 'usb'
    addressLabel: string
    addressHint: string
    defaultPort: string
}

interface ManualPrinterConfig {
    typeId: PrinterTypeId | ''
    address: string
    port: string
    paperWidth: 58 | 80
    copies: number
    headerText: string
    footerText: string
    autoPrint: boolean
    enabled: boolean
    printerName: string
    lineSpacing: number
    feedAfterCut: number
    paddingTop: number
    paddingBottom: number
    labelWidth?: number
    labelHeight?: number
}

// ─── Printer type catalogue ───────────────────────────────────────────────────
const PRINTER_TYPES: PrinterTypeOption[] = [
    {
        id: 'xprinter-wifi',
        label: 'Máy in hoá đơn XPrinter (Wifi, LAN)',
        connection: 'network',
        addressLabel: 'Địa chỉ IP máy in',
        addressHint: 'VD: 192.168.1.100',
        defaultPort: '9100',
    },
    {
        id: 'xprinter-bluetooth',
        label: 'Máy in hoá đơn XPrinter (Bluetooth)',
        connection: 'bluetooth',
        addressLabel: 'Địa chỉ MAC hoặc COM port',
        addressHint: 'VD: 00:11:22:33:44:55 hoặc COM13',
        defaultPort: '',
    },
    {
        id: 'xprinter-usb',
        label: 'Máy in hoá đơn XPrinter (USB)',
        connection: 'usb',
        addressLabel: 'Tên máy in trong Windows',
        addressHint: 'VD: XP-58',
        defaultPort: '',
    },
    {
        id: 'epson-wifi',
        label: 'Máy in hoá đơn Epson (Wifi, LAN)',
        connection: 'network',
        addressLabel: 'Địa chỉ IP máy in',
        addressHint: 'VD: 192.168.1.101',
        defaultPort: '9100',
    },
    {
        id: 'epson-bluetooth',
        label: 'Máy in hoá đơn Epson (Bluetooth)',
        connection: 'bluetooth',
        addressLabel: 'Địa chỉ MAC hoặc COM port',
        addressHint: 'VD: 00:11:22:33:44:55 hoặc COM3',
        defaultPort: '',
    },
    {
        id: 'sunmi-bluetooth',
        label: 'Máy in tích hợp Sunmi (Bluetooth)',
        connection: 'bluetooth',
        addressLabel: 'Địa chỉ MAC Bluetooth',
        addressHint: 'VD: AA:BB:CC:DD:EE:FF',
        defaultPort: '',
    },
    {
        id: 'other-wifi',
        label: 'Máy in khác (Wifi, LAN)',
        connection: 'network',
        addressLabel: 'Địa chỉ IP máy in',
        addressHint: 'VD: 192.168.1.200',
        defaultPort: '9100',
    },
]

const LABEL_SIZES = [
    { label: 'Loại 60x40mm', width: 60, height: 40 },
    { label: 'Loại 58x40mm', width: 58, height: 40 },
    { label: 'Loại 50x40mm', width: 50, height: 40 },
    { label: 'Loại 50x70mm', width: 50, height: 70 },
    { label: 'Loại 50x30mm', width: 50, height: 30 },
    { label: 'Loại 40x40mm', width: 40, height: 40 },
    { label: 'Loại 40x30mm', width: 40, height: 30 },
    { label: 'Loại 37x30mm', width: 37, height: 30 },
] as const

// ─── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_BILL: BillConfig = {
    enabled: true, printerId: null, paperWidth: 80, autoPrint: true,
    copies: 1, showLogo: true, headerText: 'KUN Matcha & Coffee',
    footerText: 'Cảm ơn quý khách! Hẹn gặp lại.', showQr: true,
}
const DEFAULT_LABEL: LabelConfig = {
    enabled: false, printerId: null, labelWidth: 50, labelHeight: 30,
    autoPrint: false, showProductName: true, showPrice: true,
    showBarcode: false, showNote: true, customText: '',
}

function makeDefaultManual(enabled = true, isBill = true): ManualPrinterConfig {
    return {
        typeId: '', address: '', printerName: '', port: '9100', paperWidth: 80,
        copies: 1, headerText: 'KUN Matcha & Coffee',
        footerText: 'Cảm ơn quý khách! Hẹn gặp lại.',
        autoPrint: true, enabled,
        lineSpacing: isBill ? 30 : 24,
        feedAfterCut: isBill ? 4 : 2,
        paddingTop: 0,
        paddingBottom: 0,
        labelWidth: 50,
        labelHeight: 30,
    }
}

// ─── UI atoms ─────────────────────────────────────────────────────────────────
function ConnIcon({ type }: { type: 'bluetooth' | 'network' | 'usb' }) {
    if (type === 'bluetooth') return <Bluetooth className="size-3.5 shrink-0 text-blue-500" />
    if (type === 'network') return <Wifi className="size-3.5 shrink-0 text-emerald-500" />
    return <Usb className="size-3.5 shrink-0 text-orange-500" />
}

function FieldLabel({ children }: { children: React.ReactNode }) {
    return <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">{children}</label>
}

function Toggle({ checked, onChange, label, sub }: {
    checked: boolean; onChange(v: boolean): void; label: string; sub?: string
}) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
            <div>
                <p className="text-sm font-semibold text-gray-800">{label}</p>
                {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
            </div>
            <button
                onClick={() => onChange(!checked)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-brand' : 'bg-gray-200'}`}
            >
                <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-5' : ''}`} />
            </button>
        </div>
    )
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            {title && (
                <div className="px-5 py-3.5 border-b border-gray-100">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{title}</p>
                </div>
            )}
            <div className="px-5 py-4">{children}</div>
        </div>
    )
}

// ─── Preview components ──────────────────────────────────────────────────────
function LabelPreview({ cfg }: { cfg: ManualPrinterConfig }) {
    const w = cfg.labelWidth ?? 50
    const h = cfg.labelHeight ?? 30
    const MM = 3.78
    const naturalW = w * MM
    const naturalH = h * MM
    const displayW = 220
    const scale = displayW / naturalW
    const displayH = Math.round(naturalH * scale)

    return (
        <div className="flex justify-center py-2">
            <div className="flex flex-col items-center gap-1.5">
                <p className="text-[10px] text-gray-400">{w}×{h}mm (mẫu)</p>
                <div style={{ width: displayW, height: displayH, overflow: 'hidden', background: 'white', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: 'top left', width: naturalW, fontFamily: "'Courier New', monospace", fontSize: 10, padding: '4px 8px', lineHeight: 1.3, color: '#000' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                            <span>KUN</span><span>1/3</span>
                        </div>
                        <div style={{ borderTop: '1px dashed #000', margin: '2px 0' }} />
                        <div style={{ fontWeight: 'bold', fontSize: 11 }}>Trà Sữa Oolong Nướng</div>
                        <div style={{ fontSize: 9 }}>+ M</div>
                        <div style={{ fontSize: 9 }}>+ Đường 50%</div>
                        <div style={{ fontSize: 9 }}>+ Ít đá</div>
                        <div style={{ fontSize: 9 }}>+ Trân châu đen</div>
                        <div style={{ fontSize: 9, fontStyle: 'italic' }}>* Ít ngọt</div>
                        <div style={{ borderTop: '1px dashed #000', margin: '2px 0' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
                            <span style={{ fontWeight: 'bold' }}>55.000đ</span><span>09:30</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function BillPreview({ cfg }: { cfg: ManualPrinterConfig }) {
    const paperW = cfg.paperWidth
    const MM = 3.78
    const naturalW = paperW * MM
    const displayW = 220
    const scale = displayW / naturalW
    const naturalH = 195
    const displayH = Math.round(naturalH * scale)

    return (
        <div className="flex justify-center py-2">
            <div className="flex flex-col items-center gap-1.5">
                <p className="text-[10px] text-gray-400">{paperW}mm (mẫu)</p>
                <div style={{ width: displayW, height: displayH, overflow: 'hidden', background: 'white', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: 'top left', width: naturalW, fontFamily: "'Courier New', monospace", fontSize: 12, padding: '4px 0', lineHeight: 1.35, color: '#000' }}>
                        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 16, letterSpacing: 2 }}>KUN</div>
                        <div style={{ textAlign: 'center', fontSize: 10 }}>{cfg.headerText || 'KUN Matcha & Coffee'}</div>
                        <div style={{ borderTop: '2px dashed #000', margin: '5px 0' }} />
                        <div style={{ fontSize: 10 }}>Đơn: KUN-20250501-0001</div>
                        <div style={{ fontSize: 10 }}>01/05/2025 09:30</div>
                        <div style={{ fontSize: 10 }}>Loại: Tại bàn</div>
                        <div style={{ borderTop: '2px dashed #000', margin: '5px 0' }} />
                        <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 4, fontWeight: 'bold', fontSize: 12 }}>
                            <span>2x</span><span>Trà Sữa Oolong Nướng</span><span style={{ whiteSpace: 'nowrap' }}>110.000đ</span>
                        </div>
                        <div style={{ marginLeft: 28, fontSize: 10, color: '#555' }}>Size: M · Đường: 50% · Đá: Ít đá</div>
                        <div style={{ borderBottom: '1px dashed #000', margin: '4px 0 3px' }} />
                        <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 4, fontWeight: 'bold', fontSize: 12 }}>
                            <span>1x</span><span>Cà Phê Muối</span><span style={{ whiteSpace: 'nowrap' }}>45.000đ</span>
                        </div>
                        <div style={{ borderTop: '2px dashed #000', margin: '5px 0' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 13 }}>
                            <span>Tổng cộng</span><span>155.000đ</span>
                        </div>
                        <div style={{ borderTop: '2px dashed #000', margin: '5px 0' }} />
                        <div style={{ textAlign: 'center', fontSize: 10 }}>{cfg.footerText || 'Cảm ơn quý khách! Hẹn gặp lại.'}</div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Device scan modal ────────────────────────────────────────────────────────
function DeviceScanModal({ onSelect, onClose, connectionType }: {
    onSelect(address: string, printerName: string): void
    onClose(): void
    connectionType: 'bluetooth' | 'usb'
}) {
    const [scanning, setScanning] = useState(true)
    const [devices, setDevices] = useState<{ address: string; name: string; printerName?: string }[]>([])

    useState(() => {
        const run = async () => {
            try {
                const sysPrinters = await eAPI?.printer.discover() ?? []
                const merged: { address: string; name: string; printerName?: string }[] = []
                const seen = new Set<string>()

                if (connectionType === 'bluetooth') {
                    const comPorts = await eAPI?.printer.scanCom() ?? []
                    const comToPrinter = new Map<string, string>()
                    for (const p of sysPrinters) {
                        if (p.connection === 'bluetooth') {
                            const addr = p.address?.toUpperCase() ?? ''
                            if (addr) comToPrinter.set(addr, p.name)
                        }
                    }
                    for (const p of comPorts) {
                        if (!p.isBluetooth) continue
                        if (seen.has(p.com)) continue
                        seen.add(p.com)
                        merged.push({
                            address: p.com,
                            name: p.name,
                            printerName: comToPrinter.get(p.com.toUpperCase()),
                        })
                    }
                    for (const p of sysPrinters) {
                        if (p.connection !== 'bluetooth') continue
                        if (seen.has(p.name)) continue
                        seen.add(p.name)
                        merged.push({
                            address: p.address ?? p.name,
                            name: p.name,
                            printerName: p.name,
                        })
                    }
                } else {
                    for (const p of sysPrinters) {
                        if (seen.has(p.name)) continue
                        seen.add(p.name)
                        if (p.connection === 'usb') {
                            merged.push({ address: p.name, name: p.name, printerName: p.name })
                        }
                    }
                }

                merged.sort((a, b) => (b.printerName ? 1 : 0) - (a.printerName ? 1 : 0))
                setDevices(merged)
            } catch (e) {
                console.error('scan error:', e)
            }
            setScanning(false)
        }
        void run()
        return () => { }
    })

    const icon = connectionType === 'usb'
        ? <Usb className="size-4 text-orange-500 shrink-0" />
        : <Bluetooth className="size-4 text-blue-500 shrink-0" />

    const title = connectionType === 'usb'
        ? 'Chọn máy in USB được kết nối:'
        : 'Chọn máy in bluetooth được kết nối:'

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-96 rounded-2xl bg-white shadow-2xl p-6 max-h-[80vh] flex flex-col">
                <h3 className="text-base font-bold text-gray-900 mb-4 text-center">{title}</h3>

                {scanning ? (
                    <div className="flex flex-col items-center gap-3 py-8">
                        <Loader2 className="size-8 animate-spin text-brand" />
                        <p className="text-sm text-gray-500">Đang tìm kiếm thiết bị…</p>
                    </div>
                ) : devices.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-sm text-gray-400">Không tìm thấy thiết bị nào</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                        {devices.map(d => (
                            <button
                                key={d.address}
                                onClick={() => onSelect(d.address, d.printerName ?? d.address)}
                                className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${d.printerName
                                    ? 'border-brand-accent/40 bg-brand-muted hover:border-brand-light hover:bg-brand-muted/80'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                            >
                                {icon}
                                <div className="min-w-0 flex-1">
                                    {d.printerName && (
                                        <p className="text-sm font-bold text-brand">{d.printerName}</p>
                                    )}
                                    <p className={`text-sm font-semibold ${d.printerName ? 'text-gray-500 text-xs' : 'text-gray-800'}`}>
                                        {d.name}
                                    </p>
                                    <p className="text-xs text-gray-400 font-mono">{d.address}</p>
                                </div>
                                {d.printerName && (
                                    <span className="shrink-0 rounded-full bg-brand-muted px-2 py-0.5 text-[10px] font-bold text-brand-light">
                                        Đã cài driver
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                <button
                    onClick={onClose}
                    className="w-full h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                    Đóng
                </button>
            </div>
        </div>
    )
}

// ─── Printer section ──────────────────────────────────────────────────────────
function PrinterSection({
    isBill, cfg, onChange, onTest, onDelete, testStatus, onSave, saving,
}: {
    isBill: boolean
    cfg: ManualPrinterConfig
    onChange(c: ManualPrinterConfig): void
    onTest(): void
    onDelete(): void
    testStatus: 'idle' | 'testing' | 'ok' | 'error'
    onSave(): void
    saving: boolean
}) {
    const [showBtScan, setShowBtScan] = useState(false)
    const selectedType = PRINTER_TYPES.find(t => t.id === cfg.typeId)
    const title = isBill ? 'in hoá đơn' : 'in tem nhãn'

    return (
        <div className="space-y-4">
            <Card>
                <Toggle
                    checked={cfg.enabled}
                    onChange={v => onChange({ ...cfg, enabled: v })}
                    label={`Bật máy ${title}`}
                    sub="Tự động in sau khi tạo đơn thành công"
                />
            </Card>

            <Card title="Loại máy in">
                <FieldLabel>Chọn loại máy in</FieldLabel>
                <select
                    value={cfg.typeId}
                    onChange={e => {
                        const t = PRINTER_TYPES.find(x => x.id === e.target.value)
                        onChange({ ...cfg, typeId: e.target.value as PrinterTypeId, port: t?.defaultPort ?? '', address: '' })
                    }}
                    className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10"
                >
                    <option value="">— Chọn loại máy in —</option>
                    {PRINTER_TYPES.map(t => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                </select>
                {selectedType && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-brand-muted px-3 py-2.5">
                        <ConnIcon type={selectedType.connection} />
                        <span className="text-xs text-gray-600">{selectedType.addressHint}</span>
                    </div>
                )}
            </Card>

            {selectedType && (
                <Card title="Cấu hình bắt buộc">
                    <div className="space-y-4">
                        {selectedType.connection === 'bluetooth' && (
                            <button
                                onClick={() => setShowBtScan(true)}
                                className="flex w-full items-center justify-center gap-2 h-11 rounded-xl bg-brand text-sm font-bold text-white hover:bg-brand/90 transition-colors"
                            >
                                <Search className="size-4" />
                                Tìm kiếm máy in bluetooth
                            </button>
                        )}

                        {selectedType.connection === 'usb' && (
                            <button
                                onClick={() => setShowBtScan(true)}
                                className="flex w-full items-center justify-center gap-2 h-11 rounded-xl bg-brand text-sm font-bold text-white hover:bg-brand/90 transition-colors"
                            >
                                <Usb className="size-4" />
                                Tìm kiếm máy in USB
                            </button>
                        )}

                        <div>
                            <FieldLabel>{selectedType.addressLabel}</FieldLabel>
                            <input
                                value={cfg.address}
                                onChange={e => onChange({ ...cfg, address: e.target.value })}
                                placeholder={selectedType.addressHint}
                                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10"
                            />
                        </div>

                        {selectedType.connection === 'network' && (
                            <div>
                                <FieldLabel>Cổng/Tên máy in</FieldLabel>
                                <input
                                    value={cfg.port}
                                    onChange={e => onChange({ ...cfg, port: e.target.value })}
                                    placeholder="9100"
                                    className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10"
                                />
                            </div>
                        )}

                        {isBill && (
                            <div>
                                <FieldLabel>Chọn kích thước giấy in</FieldLabel>
                                <div className="flex gap-2">
                                    {([58, 80] as const).map(w => (
                                        <button
                                            key={w}
                                            onClick={() => onChange({ ...cfg, paperWidth: w })}
                                            className={`flex-1 h-11 rounded-xl border text-sm font-semibold transition-colors ${cfg.paperWidth === w
                                                ? 'border-brand bg-brand-muted text-brand'
                                                : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-brand-accent'
                                                }`}
                                        >
                                            Loại {w}mm
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!isBill && (
                            <div>
                                <FieldLabel>Chọn kích thước tem nhãn</FieldLabel>
                                <select
                                    value={`${cfg.labelWidth}x${cfg.labelHeight}`}
                                    onChange={e => {
                                        const [w, h] = e.target.value.split('x').map(Number)
                                        onChange({ ...cfg, labelWidth: w, labelHeight: h })
                                    }}
                                    className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10"
                                >
                                    {LABEL_SIZES.map(s => (
                                        <option key={s.label} value={`${s.width}x${s.height}`}>
                                            {s.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </Card>
            )}

            <Card title="Cài đặt thêm">
                <div className="space-y-0">
                    <Toggle
                        checked={cfg.autoPrint}
                        onChange={v => onChange({ ...cfg, autoPrint: v })}
                        label="Cho phép in tự động đơn tại quán"
                        sub="Tự động in khi đơn được tạo thành công"
                    />
                    {isBill && (
                        <>
                            <div className="pt-3">
                                <FieldLabel>Tiêu đề hoá đơn</FieldLabel>
                                <textarea
                                    value={cfg.footerText}
                                    onChange={e => onChange({ ...cfg, footerText: e.target.value })}
                                    rows={2}
                                    placeholder="Cảm ơn quý khách! Hẹn gặp lại."
                                    className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10"
                                />
                            </div>
                            <div className="pt-3">
                                <FieldLabel>Số lượng hoá đơn in mỗi lần</FieldLabel>
                                <select
                                    value={cfg.copies}
                                    onChange={e => onChange({ ...cfg, copies: Number(e.target.value) })}
                                    className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm focus:border-brand focus:outline-none"
                                >
                                    {[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>
                        </>
                    )}
                </div>
            </Card>

            <Card title="Khoảng cách in">
                <SpacingSlider
                    label="Khoảng cách dòng"
                    sub="ESC 3 n — nhỏ hơn = dày hơn, lớn hơn = thưa hơn"
                    value={cfg.lineSpacing ?? (isBill ? 30 : 24)}
                    min={0} max={80} defaultVal={isBill ? 30 : 24}
                    onChange={v => onChange({ ...cfg, lineSpacing: v })}
                />
                <SpacingSlider
                    label="Feed lines sau khi cắt giấy"
                    sub="Số dòng trống trước khi cắt"
                    value={cfg.feedAfterCut ?? (isBill ? 4 : 2)}
                    min={0} max={10} defaultVal={isBill ? 4 : 2}
                    onChange={v => onChange({ ...cfg, feedAfterCut: v })}
                />
                {!isBill && (
                    <>
                        <SpacingSlider
                            label="Padding trên"
                            sub="Dòng trống phía trên nội dung nhãn"
                            value={cfg.paddingTop ?? 0}
                            min={0} max={5} defaultVal={0}
                            onChange={v => onChange({ ...cfg, paddingTop: v })}
                        />
                        <SpacingSlider
                            label="Padding dưới"
                            sub="Dòng trống phía dưới nội dung nhãn"
                            value={cfg.paddingBottom ?? 0}
                            min={0} max={5} defaultVal={0}
                            onChange={v => onChange({ ...cfg, paddingBottom: v })}
                        />
                    </>
                )}
            </Card>

            <Card title="Xem trước kết quả in">
                {isBill ? <BillPreview cfg={cfg} /> : <LabelPreview cfg={cfg} />}
            </Card>

            <div className="space-y-2">
                <button
                    onClick={onSave}
                    disabled={saving}
                    className="flex w-full items-center justify-center gap-2 h-12 rounded-xl bg-brand text-sm font-bold text-white hover:bg-brand/90 disabled:opacity-60 transition-colors"
                >
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    {saving ? 'Đang lưu…' : 'Lưu lại'}
                </button>

                <button
                    onClick={onTest}
                    disabled={!cfg.address || testStatus === 'testing'}
                    className="flex w-full items-center justify-center gap-2 h-12 rounded-xl border border-brand-accent/40 bg-brand-muted text-sm font-semibold text-brand hover:bg-brand-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {testStatus === 'testing' ? (
                        <><Loader2 className="size-4 animate-spin" /> Đang kiểm tra…</>
                    ) : testStatus === 'ok' ? (
                        <><CheckCircle2 className="size-4 text-emerald-600" /> Kết nối tốt — In thử thành công</>
                    ) : testStatus === 'error' ? (
                        <><XCircle className="size-4 text-red-500" /> Không kết nối được máy in</>
                    ) : (
                        <><FlaskConical className="size-4" /> In kiểm tra kết nối máy in</>
                    )}
                </button>

                <button
                    onClick={onDelete}
                    className="flex w-full items-center justify-center gap-2 h-11 rounded-xl border border-red-200 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors"
                >
                    <Trash2 className="size-4" />
                    Xoá cài đặt máy in
                </button>
            </div>

            {showBtScan && (
                <DeviceScanModal
                    connectionType={selectedType?.connection === 'usb' ? 'usb' : 'bluetooth'}
                    onSelect={(address, printerName) => {
                        onChange({ ...cfg, address: printerName ?? address, printerName: printerName ?? address })
                        setShowBtScan(false)
                    }}
                    onClose={() => setShowBtScan(false)}
                />
            )}
        </div>
    )
}

// ─── ShopeeFood section ───────────────────────────────────────────────────────
function ShopeeSection() {
    const shopeeCalls = (eAPI as unknown as {
        spfPartner?: {
            getStatus(): Promise<{ connected: boolean; polling: boolean; restaurantId: string | null; restaurantName: string | null; savedAt: string | null; pollIntervalMs: number }>
            webLogin(): Promise<{ ok: boolean; restaurantId?: string; error?: string }>
            reset(): Promise<{ ok: boolean }>
            setPollInterval(ms: number): Promise<void>
        }
    })

    // Partner API status
    const [partnerStatus, setPartnerStatus] = useState<{ connected: boolean; polling: boolean; restaurantId: string | null; restaurantName: string | null; savedAt: string | null; pollIntervalMs: number } | null>(null)
    const [webLogging, setWebLogging] = useState(false)
    const [loginError, setLoginError] = useState<string | null>(null)
    const [resetting, setResetting] = useState(false)
    const [pollIntervalSecs, setPollIntervalSecs] = useState(15)
    const pollInitRef = useRef(false)

    const refreshAll = useCallback(async () => {
        try {
            const partner = await shopeeCalls.spfPartner?.getStatus()
            if (partner) {
                setPartnerStatus(partner)
                if (!pollInitRef.current && partner.pollIntervalMs > 0) {
                    pollInitRef.current = true
                    setPollIntervalSecs(Math.round(partner.pollIntervalMs / 1000))
                }
            }
        } catch { /* ignore */ }
    }, [])

    useEffect(() => {
        void refreshAll()
        const t = setInterval(() => void refreshAll(), 3000)
        return () => clearInterval(t)
    }, [refreshAll])

    async function webLogin() {
        setWebLogging(true)
        setLoginError(null)
        try {
            const result = await shopeeCalls.spfPartner?.webLogin()
            if (result?.ok) {
                await refreshAll()
            } else {
                setLoginError(result?.error ?? 'Đăng nhập thất bại')
            }
        } finally { setWebLogging(false) }
    }

    async function resetPartner() {
        setResetting(true)
        try {
            await shopeeCalls.spfPartner?.reset()
            setLoginError(null)
            await refreshAll()
        } finally { setResetting(false) }
    }

    const partnerConnected = partnerStatus?.connected ?? false

    return (
        <div className="space-y-4">
            <Card title="ShopeeFood Partner API (trực tiếp)">
                <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                        <span className={`inline-block size-2.5 rounded-full ${partnerConnected ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                        <span className="text-sm font-semibold text-gray-800">
                            {partnerConnected ? 'Đã kết nối Partner API' : 'Chưa kết nối'}
                        </span>
                        {partnerConnected && partnerStatus?.polling && (
                            <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">polling</span>
                        )}
                    </div>

                    {partnerConnected && partnerStatus?.restaurantId && (
                        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm rounded-xl bg-gray-50 px-3 py-3">
                            <span className="text-gray-400 self-center">Nhà hàng</span>
                            <span className="font-medium text-gray-800 truncate">{partnerStatus.restaurantName ?? '—'}</span>
                            <span className="text-gray-400 self-center">Restaurant ID</span>
                            <span className="font-mono text-xs font-semibold text-gray-700">{partnerStatus.restaurantId}</span>
                            {partnerStatus.savedAt && (
                                <>
                                    <span className="text-gray-400 self-center">Lưu lúc</span>
                                    <span className="text-xs text-gray-500">{new Date(partnerStatus.savedAt).toLocaleString('vi-VN')}</span>
                                </>
                            )}
                        </div>
                    )}

                    {!partnerConnected ? (
                        <div className="space-y-2">
                            <button
                                onClick={() => void webLogin()}
                                disabled={webLogging}
                                className="flex w-full items-center justify-center gap-2 h-12 rounded-xl bg-[#EE4D2D] text-sm font-bold text-white hover:bg-[#d94429] disabled:opacity-60 transition-colors"
                            >
                                {webLogging ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBagIcon className="size-4" />}
                                {webLogging ? 'Đang chờ đăng nhập…' : 'Đăng nhập ShopeeFood Partner (mở trình duyệt)'}
                            </button>
                            <p className="text-xs text-gray-400 text-center">
                                Đăng nhập partner.shopee.vn → chọn nhà hàng → bấm nút đỏ trong cửa sổ
                            </p>
                            {loginError && (
                                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{loginError}</p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <SpacingSlider
                                label={`Kiểm tra mỗi ${pollIntervalSecs}s`}
                                sub="UjCha POS gọi ShopeeFood Partner API theo chu kỳ này để phát hiện đơn mới"
                                value={pollIntervalSecs}
                                min={5} max={60} defaultVal={15}
                                onChange={setPollIntervalSecs}
                            />
                            <button
                                disabled={pollIntervalSecs === Math.round((partnerStatus?.pollIntervalMs ?? 15000) / 1000)}
                                onClick={() => void shopeeCalls.spfPartner?.setPollInterval(pollIntervalSecs * 1000).then(() => refreshAll())}
                                className="flex w-full items-center justify-center gap-2 h-9 rounded-xl bg-[#EE4D2D] text-sm font-bold text-white hover:bg-[#d94429] disabled:opacity-60 transition-colors"
                            >
                                <Save className="size-3.5" />
                                Lưu khoảng thời gian
                            </button>
                            <button
                                onClick={() => void resetPartner()}
                                disabled={resetting}
                                className="flex w-full items-center justify-center gap-2 h-10 rounded-xl border border-red-200 text-sm font-semibold text-red-500 hover:bg-red-50 disabled:opacity-60 transition-colors"
                            >
                                {resetting ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                                Ngắt kết nối Partner API
                            </button>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    )
}

// ─── GrabFood section ─────────────────────────────────────────────────────────
function GrabSection() {
    const grabCalls = (eAPI as unknown as {
        grab?: {
            getStatus(): Promise<{ polling: boolean; lastPollTime: string | null; lastPollStatus: string; hasAuth: boolean; merchantName: string | null; merchantID: string | null; merchantGroupID: string | null; grabId: string | null; email: string | null; role: string | null; displayRole: string | null; pollIntervalMs: number }>
            setPollInterval(ms: number): Promise<void>
            reset(): Promise<{ ok: boolean }>
            webLogin(): Promise<{ ok: boolean; merchantName?: string; error?: string }>
            sync(): Promise<{ ok: boolean; connected: boolean; error?: string }>
        }
    })
    const [status, setStatus] = useState<{ polling: boolean; lastPollTime: string | null; lastPollStatus: string; hasAuth: boolean; merchantName: string | null; merchantID: string | null; merchantGroupID: string | null; grabId: string | null; email: string | null; role: string | null; displayRole: string | null; pollIntervalMs: number } | null>(null)
    const [webLogging, setWebLogging] = useState(false)
    const [connectError, setConnectError] = useState<string | null>(null)
    const [resetting, setResetting] = useState(false)
    const [pollIntervalSecs, setPollIntervalSecs] = useState(5)
    const pollInitRef = useRef(false)
    const [syncing, setSyncing] = useState(false)
    console.log({ status })
    const refresh = useCallback(async () => {
        try {
            const s = await grabCalls.grab?.getStatus()
            if (s) {
                setStatus(s)
                if (!pollInitRef.current && s.pollIntervalMs > 0) {
                    pollInitRef.current = true
                    setPollIntervalSecs(Math.round(s.pollIntervalMs / 1000))
                }
            }
        } catch { /* ignore */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        void refresh()
        const t = setInterval(() => void refresh(), 3000)
        return () => clearInterval(t)
    }, [refresh])

    async function webLogin() {
        setWebLogging(true)
        setConnectError(null)
        try {
            const result = await grabCalls.grab?.webLogin()
            if (result?.ok) {
                await refresh()
            } else {
                setConnectError(result?.error ?? 'Đăng nhập thất bại')
            }
        } finally {
            setWebLogging(false)
        }
    }

    async function resetGrab() {
        setResetting(true)
        try {
            await grabCalls.grab?.reset()
            setConnectError(null)
            await refresh()
        } finally {
            setResetting(false)
        }
    }

    async function savePollInterval() {
        await grabCalls.grab?.setPollInterval(pollIntervalSecs * 1000)
        await refresh()
    }

    async function syncSession() {
        setSyncing(true)
        try {
            await grabCalls.grab?.sync()
            await refresh()
        } finally {
            setSyncing(false)
        }
    }

    const hasAuth = status?.hasAuth ?? false
    const polling = status?.polling ?? false
    const authError = status?.lastPollStatus === 'auth_error'
    return (
        <div className="space-y-4">
            <Card title="Trạng thái kết nối">
                <div className="flex items-center gap-2.5">
                    <span className={`inline-block size-2.5 rounded-full ${polling && !authError ? 'bg-emerald-500' : hasAuth && authError ? 'bg-red-400' : 'bg-gray-300'}`} />
                    <span className="text-sm font-semibold text-gray-800">
                        {polling && !authError
                            ? `Đã kết nối`
                            : authError
                                ? 'Phiên hết hạn — kết nối lại'
                                : hasAuth
                                    ? `Đã kết nối${status?.merchantName ? ` — ${status.merchantName}` : ''}`
                                    : 'Chưa kết nối'}
                    </span>
                    {status?.lastPollTime && (
                        <span className="text-xs text-gray-400 ml-auto">
                            {new Date(status.lastPollTime).toLocaleTimeString('vi-VN')}
                        </span>
                    )}
                </div>
            </Card>

            {(!hasAuth || authError) ? (
                <Card title="Đăng nhập GrabFood Merchant">
                    <div className="space-y-3">
                        <button
                            onClick={() => void webLogin()}
                            disabled={webLogging}
                            className="flex w-full items-center justify-center gap-2 h-12 rounded-xl bg-brand text-sm font-bold text-white hover:bg-brand/90 disabled:opacity-60 transition-colors"
                        >
                            {webLogging ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBagIcon className="size-4" />}
                            {webLogging ? 'Đang chờ đăng nhập…' : 'Đăng nhập GrabFood (mở trình duyệt)'}
                        </button>
                        <p className="text-xs text-gray-400 text-center">Cửa sổ <b>merchant.grab.com</b> sẽ mở — đăng nhập xong bấm nút xanh "Xác nhận đã đăng nhập" trong cửa sổ đó</p>
                        {connectError && (
                            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                                {connectError}
                            </p>
                        )}
                    </div>
                </Card>
            ) : (
                <>
                    <Card title="Thông tin tài khoản GrabFood">
                        <div className="space-y-3">
                            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                                {(status?.merchantName || status?.email) && (
                                    <>
                                        <span className="text-gray-400 self-center">Tên</span>
                                        <span className="font-medium text-gray-800">{status?.merchantName ?? '—'}</span>
                                    </>
                                )}
                                {status?.email && (
                                    <>
                                        <span className="text-gray-400 self-center">Email</span>
                                        <span className="font-medium text-gray-800">{status.email}</span>
                                    </>
                                )}
                                {status?.displayRole && (
                                    <>
                                        <span className="text-gray-400 self-center">Vai trò</span>
                                        <span className="font-medium text-gray-800">{status.displayRole}</span>
                                    </>
                                )}
                                {status?.merchantID ? (
                                    <>
                                        <span className="text-gray-400 self-center">Merchant ID</span>
                                        <span className="font-mono text-xs font-semibold text-gray-800">{status.merchantID}</span>
                                    </>
                                ) : (
                                    <div className="col-span-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                                        Chưa lấy được Merchant ID — bấm "Sync session" để thử lại
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => void syncSession()}
                                disabled={syncing}
                                className="flex w-full items-center justify-center gap-2 h-9 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-60"
                            >
                                {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                                {syncing ? 'Đang sync…' : 'Sync session'}
                            </button>
                        </div>
                    </Card>
                    <Card title="Tần suất kiểm tra đơn mới">
                        <SpacingSlider
                            label={`Kiểm tra mỗi ${pollIntervalSecs}s`}
                            sub="UjCha POS gọi GrabFood API theo chu kỳ này để phát hiện đơn mới"
                            value={pollIntervalSecs}
                            min={3} max={60} defaultVal={5}
                            onChange={setPollIntervalSecs}
                        />
                        <button
                            disabled={syncing || pollIntervalSecs === (status?.pollIntervalMs ?? 0) / 1000}
                            onClick={() => void savePollInterval()}
                            className={`mt-3 flex w-full items-center justify-center gap-2 h-9 rounded-xl bg-brand text-sm font-bold text-white hover:bg-brand/90 disabled:opacity-60 transition-colors ${syncing || pollIntervalSecs === (status?.pollIntervalMs ?? 0) / 1000 ? 'cursor-not-allowed' : ''}`}
                        >
                            <Save className="size-3.5" />
                            Lưu khoảng thời gian
                        </button>
                    </Card>
                    <Card title="Kết nối">
                        <button
                            onClick={() => void resetGrab()}
                            disabled={resetting}
                            className="flex w-full items-center justify-center gap-2 h-10 rounded-xl border border-red-200 text-sm font-semibold text-red-500 hover:bg-red-50 disabled:opacity-60"
                        >
                            {resetting ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                            Ngắt kết nối GrabFood
                        </button>
                    </Card>

                </>
            )}
        </div>
    )
}

function semverGt(a: string, b: string): boolean {
    const pa = a.split('.').map(Number)
    const pb = b.split('.').map(Number)
    for (let i = 0; i < 3; i++) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
        if (diff !== 0) return diff > 0
    }
    return false
}

// ─── Account section ──────────────────────────────────────────────────────────
function AccountSection({ config }: { config: PosConfig }) {
    const user = config.adminUser
    const [appVersion, setAppVersion] = useState('')
    const [checkState, setCheckState] = useState<'idle' | 'checking' | 'latest' | 'available'>('idle')
    const [updateInfo, setUpdateInfo] = useState<{ version: string; downloadUrl: string } | null>(null)

    useEffect(() => {
        eAPI?.app?.getVersion().then(setAppVersion).catch(() => { })
        // listen for background auto-check (every 4h)
        const unsub = eAPI?.updater?.onAvailable((info) => {
            setUpdateInfo(info)
            setCheckState('available')
        })
        return () => unsub?.()
    }, [])

    async function handleCheck() {
        setCheckState('checking')
        setUpdateInfo(null)
        try {
            const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''
            const res = await fetch(`${base}/kun-pos/version`, {
                signal: AbortSignal.timeout(10_000),
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const info = await res.json() as { version: string; downloadUrl: string; releaseNotes: string }
            const current = await eAPI?.app?.getVersion() ?? appVersion
            if (current) setAppVersion(current)
            if (semverGt(info.version, current)) {
                setUpdateInfo(info)
                setCheckState('available')
            } else {
                setCheckState('latest')
            }
        } catch {
            setCheckState('idle')
        }
    }

    return (
        <div className="space-y-4">
            <Card title="Thông tin tài khoản">
                <div className="divide-y divide-gray-100 -mx-5 -my-4">
                    {[
                        { icon: <User className="size-4 text-gray-400" />, label: 'Tên', value: user?.name || '—' },
                        { icon: <Mail className="size-4 text-gray-400" />, label: 'Email', value: user?.email || '—' },
                        { icon: <Shield className="size-4 text-gray-400" />, label: 'Vai trò', value: user?.role === 'staff' ? 'Nhân viên' : 'Quản trị viên' },
                        { icon: <FileText className="size-4 text-gray-400" />, label: 'Phiên bản', value: appVersion || '…' },
                    ].map(row => (
                        <div key={row.label} className="flex items-center gap-3 px-5 py-3.5">
                            {row.icon}
                            <span className="text-sm text-gray-500 w-28 shrink-0">{row.label}</span>
                            <span className="text-sm font-semibold text-gray-800 truncate">{row.value}</span>
                        </div>
                    ))}
                </div>
            </Card>

            <Card title="Cập nhật phần mềm">
                {checkState === 'available' && updateInfo ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5">
                            <Download className="size-4 text-emerald-600 shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-emerald-800">Có bản mới: v{updateInfo.version}</p>
                                <p className="text-xs text-emerald-600">Phiên bản hiện tại: v{appVersion}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => eAPI?.updater?.openDownload(updateInfo.downloadUrl)}
                            className="flex w-full items-center justify-center gap-2 h-11 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 transition-colors"
                        >
                            <Download className="size-4" />
                            Tải về và cài đặt
                        </button>
                        <button
                            onClick={() => { setCheckState('idle'); setUpdateInfo(null) }}
                            className="w-full text-xs text-gray-400 hover:text-gray-600 text-center py-1"
                        >
                            Bỏ qua
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-xs text-gray-500">
                            {checkState === 'latest'
                                ? 'Bạn đang dùng phiên bản mới nhất.'
                                : 'Kiểm tra xem có phiên bản mới không.'}
                        </p>
                        <button
                            onClick={() => void handleCheck()}
                            disabled={checkState === 'checking'}
                            className="flex w-full items-center justify-center gap-2 h-11 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60 transition-colors"
                        >
                            {checkState === 'checking'
                                ? <><Loader2 className="size-4 animate-spin" /> Đang kiểm tra…</>
                                : checkState === 'latest'
                                    ? <><CheckCircle2 className="size-4 text-emerald-500" /> Đã là phiên bản mới nhất</>
                                    : <><RefreshCw className="size-4" /> Kiểm tra cập nhật</>}
                        </button>
                    </div>
                )}
            </Card>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                <p className="text-xs text-amber-700 leading-relaxed">
                    Để thay đổi thông tin tài khoản, vui lòng liên hệ quản trị viên hoặc đăng nhập lại.
                </p>
            </div>
        </div>
    )
}

const TTS_VOICES = [
    { id: 'hcm-diemmy', label: 'Điềm My — HCM (nữ)' },
    { id: 'hcm-thunguyen', label: 'Thu Nguyên — HCM (nữ)' },
    { id: 'hcm-minhquang', label: 'Minh Quang — HCM (nam)' },
    { id: 'hn-linhsan', label: 'Linh San — HN (nữ)' },
    { id: 'hn-letan', label: 'Lê Tân — HN (nam)' },
] as const

// ─── AI section ──────────────────────────────────────────────────────────────
function AiSection() {

    const [hasKey, setHasKey] = useState<boolean | null>(null)
    const [enabled, setEnabled] = useState(false)
    const [aiName, setAiName] = useState('Thu')
    const [nameInput, setNameInput] = useState('Thu')
    const [saving, setSaving] = useState(false)

    // TTS config state
    const [ttsVoice, setTtsVoice] = useState('hcm-diemmy')
    const [ttsSpeed, setTtsSpeed] = useState(1.0)
    const [ttsWithoutFilter, setTtsWithoutFilter] = useState(false)
    const [ttsSaving, setTtsSaving] = useState(false)
    const [ttsSaved, setTtsSaved] = useState(false)

    useEffect(() => {
        const load = async () => {
            const [key, cfg, ttsCfg] = await Promise.all([
                eAPI?.ai?.hasKey().catch(() => false),
                eAPI?.ai?.getAppConfig().catch(() => ({ enabled: false, name: 'Thu' })),
                eAPI?.tts?.getConfig().catch(() => ({})),
            ])
            setHasKey(!!key)
            if (cfg) { setEnabled(cfg.enabled); setAiName(cfg.name); setNameInput(cfg.name) }
            if (ttsCfg) {
                if (ttsCfg['voice']) setTtsVoice(ttsCfg['voice'] as string)
                if (ttsCfg['speed']) setTtsSpeed(ttsCfg['speed'] as number)
                if (ttsCfg['without_filter'] !== undefined) setTtsWithoutFilter(!!ttsCfg['without_filter'])
            }
        }
        void load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    async function handleToggle(next: boolean) {
        setEnabled(next)
        await eAPI?.ai?.setAppConfig({ enabled: next })
        eAPI?.customer?.update({ type: 'ai-mode', enabled: next, name: aiName })
    }

    async function handleSaveName() {
        const name = nameInput.trim() || 'Thu'
        setSaving(true)
        setAiName(name)
        await eAPI?.ai?.setAppConfig({ name })
        if (enabled) eAPI?.customer?.update({ type: 'ai-mode', enabled: true, name })
        setSaving(false)
    }

    async function handleSaveTts() {
        setTtsSaving(true)
        await eAPI?.tts?.setConfig({ voice: ttsVoice, speed: ttsSpeed, tts_return_option: 3, without_filter: ttsWithoutFilter })
        setTtsSaving(false)
        setTtsSaved(true)
        setTimeout(() => setTtsSaved(false), 2500)
    }

    return (
        <div className="space-y-4">
            <Card title="Trạng thái API key">
                {hasKey === null ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Loader2 className="size-4 animate-spin" />
                        Đang kiểm tra…
                    </div>
                ) : hasKey ? (
                    <div className="flex items-center gap-2 text-sm text-emerald-600">
                        <CheckCircle2 className="size-4" />
                        API key Gemini đã cấu hình
                    </div>
                ) : (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-amber-600">
                            <XCircle className="size-4 text-amber-500" />
                            Chưa có API key
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Thêm <code className="rounded bg-gray-100 px-1 py-0.5 font-mono">ANTHROPIC_API_KEY=sk-ant-...</code> vào file{' '}
                            <code className="rounded bg-gray-100 px-1 py-0.5 font-mono">.env</code> rồi khởi động lại app.
                        </p>
                    </div>
                )}
            </Card>

            <Card>
                <Toggle
                    checked={enabled}
                    onChange={(v) => { void handleToggle(v) }}
                    label="Bật AI Thu ngân"
                    sub={`Hiển thị nhân vật ${aiName} trên màn hình khách hàng`}
                />
            </Card>

            <Card title="Tên nhân vật AI">
                <p className="mb-3 text-xs text-gray-500">Tên sẽ hiện trên màn hình khách và trong hội thoại với AI.</p>
                <div className="flex gap-2">
                    <input
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveName() }}
                        placeholder="Thu, Lan, An, ..."
                        className="h-11 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10"
                    />
                    <button
                        onClick={() => void handleSaveName()}
                        disabled={saving}
                        className="flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
                    >
                        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                        Lưu
                    </button>
                </div>
            </Card>

            <Card title="Cấu hình giọng nói TTS">
                <div className="space-y-4">
                    <div>
                        <FieldLabel>Giọng đọc</FieldLabel>
                        <select
                            value={ttsVoice}
                            onChange={e => setTtsVoice(e.target.value)}
                            className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10"
                        >
                            {TTS_VOICES.map(v => (
                                <option key={v.id} value={v.id}>{v.label}</option>
                            ))}
                        </select>
                    </div>

                    <SpacingSlider
                        label={`Tốc độ đọc: ${ttsSpeed.toFixed(1)}×`}
                        sub="0.5 = chậm, 1.0 = bình thường, 2.0 = nhanh"
                        value={Math.round(ttsSpeed * 10)}
                        min={5} max={20} defaultVal={10}
                        onChange={v => setTtsSpeed(v / 10)}
                    />

                    <Toggle
                        checked={ttsWithoutFilter}
                        onChange={setTtsWithoutFilter}
                        label="Tắt bộ lọc từ ngữ Viettel"
                        sub="Đọc đúng hơn nhưng không kiểm duyệt nội dung"
                    />

                    <button
                        onClick={() => void handleSaveTts()}
                        disabled={ttsSaving}
                        className="flex w-full items-center justify-center gap-2 h-11 rounded-xl bg-brand text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60 transition-colors"
                    >
                        {ttsSaving ? (
                            <><Loader2 className="size-4 animate-spin" /> Đang lưu…</>
                        ) : ttsSaved ? (
                            <><CheckCircle2 className="size-4" /> Đã lưu</>
                        ) : (
                            <><Volume2 className="size-4" /> Lưu cấu hình TTS</>
                        )}
                    </button>
                </div>
            </Card>
        </div>
    )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function SettingsPage({
    onClose,
    config,
    onSave,
}: {
    onClose: () => void
    config: PosConfig
    onSave: (cfg: PosConfig) => Promise<void>
}) {
    const [section, setSection] = useState<Section>('account')
    const [saving, setSaving] = useState(false)

    const [billCfg, setBillCfg] = useState<ManualPrinterConfig>(() => {
        const saved = loadLocal<BillConfig>(KEYS.bill, DEFAULT_BILL)
        return {
            typeId: (saved.typeId as PrinterTypeId) || '',
            address: saved.address || '',
            printerName: saved.printerName || saved.address || '',
            port: '9100',
            paperWidth: (saved.paperWidth === 58 || saved.paperWidth === 80) ? saved.paperWidth : 58,
            copies: saved.copies ?? 1,
            headerText: saved.headerText || 'KUN Matcha & Coffee',
            footerText: saved.footerText || 'Cảm ơn quý khách! Hẹn gặp lại.',
            autoPrint: saved.autoPrint ?? true,
            enabled: saved.enabled ?? true,
            lineSpacing: saved.lineSpacing ?? 30,
            feedAfterCut: saved.feedAfterCut ?? 4,
            paddingTop: 0,
            paddingBottom: 0,
            labelWidth: 50,
            labelHeight: 30,
        }
    })

    const [labelCfg, setLabelCfg] = useState<ManualPrinterConfig>(() => {
        const saved = loadLocal<LabelConfig>(KEYS.label, DEFAULT_LABEL)
        return {
            typeId: (saved.typeId as PrinterTypeId) || '',
            address: saved.address || '',
            printerName: saved.printerName || saved.address || '',
            port: '9100',
            paperWidth: 80,
            labelWidth: saved.labelWidth ?? 50,
            labelHeight: saved.labelHeight ?? 30,
            copies: 1,
            headerText: '',
            footerText: '',
            autoPrint: saved.autoPrint,
            enabled: saved.enabled,
            lineSpacing: saved.lineSpacing ?? 24,
            feedAfterCut: saved.feedAfterCut ?? 2,
            paddingTop: saved.paddingTop ?? 0,
            paddingBottom: saved.paddingBottom ?? 0,
        }
    })

    const [billTestStatus, setBillTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
    const [labelTestStatus, setLabelTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')

    function manualToBill(m: ManualPrinterConfig): BillConfig {
        return {
            enabled: m.enabled,
            printerId: m.address ? `manual-${m.address}` : null,
            paperWidth: m.paperWidth,
            autoPrint: m.autoPrint,
            copies: m.copies,
            showLogo: true,
            headerText: m.headerText || 'KUN Matcha & Coffee',
            footerText: m.footerText || 'Cảm ơn quý khách!',
            showQr: true,
            address: m.address || null,
            printerName: m.printerName || m.address || null,
            typeId: m.typeId,
            lineSpacing: m.lineSpacing,
            feedAfterCut: m.feedAfterCut,
        }
    }

    function manualToLabel(m: ManualPrinterConfig): LabelConfig {
        return {
            enabled: m.enabled,
            printerId: m.address ? `manual-${m.address}` : null,
            labelWidth: m.labelWidth!,
            labelHeight: m.labelHeight!,
            autoPrint: m.autoPrint,
            showProductName: true,
            showPrice: true,
            showBarcode: false,
            showNote: true,
            customText: '',
            address: m.address || null,
            printerName: m.address || null,
            typeId: m.typeId,
            lineSpacing: m.lineSpacing,
            feedAfterCut: m.feedAfterCut,
            paddingTop: m.paddingTop,
            paddingBottom: m.paddingBottom,
        }
    }

    async function handleTest(
        cfg: ManualPrinterConfig,
        type: 'bill' | 'label',
        setStatus: (s: 'idle' | 'testing' | 'ok' | 'error') => void,
    ) {
        if (!cfg.address) return
        setStatus('testing')
        try {
            if (eAPI?.printer) {
                const res = await (eAPI.printer as any).testPrintByAddress(
                    cfg.address,
                    type,
                    cfg.printerName || cfg.address,
                )
                setStatus(res?.ok ? 'ok' : 'error')
            } else {
                await new Promise(r => setTimeout(r, 1200))
                setStatus('ok')
            }
        } catch {
            setStatus('error')
        }
        setTimeout(() => setStatus('idle'), 4000)
    }

    async function handleSave() {
        setSaving(true)
        try {
            saveLocal(KEYS.bill, manualToBill(billCfg))
            saveLocal(KEYS.label, manualToLabel(labelCfg))
            await onSave(config)
        } catch (e) {
            console.error('Save failed:', e)
        } finally {
            setSaving(false)
        }
    }

    const MENU: { id: Section; label: string; sub: string; icon: React.ReactNode }[] = [
        {
            id: 'account',
            label: 'Thông tin tài khoản',
            sub: config.adminUser?.email || '—',
            icon: <User className="size-4" />,
        },
        {
            id: 'printer-bill',
            label: 'Cài đặt máy in đơn',
            sub: billCfg.enabled && billCfg.address ? billCfg.address : 'Chưa cấu hình',
            icon: <Printer className="size-4" />,
        },
        {
            id: 'printer-label',
            label: 'Cài đặt máy in tem nhãn',
            sub: labelCfg.enabled && labelCfg.address ? labelCfg.address : 'Chưa cấu hình',
            icon: <Tag className="size-4" />,
        },
        {
            id: 'partners',
            label: 'Kết nối đối tác',
            sub: 'GrabFood & ShopeeFood',
            icon: <HandshakeIcon className="size-4" />,
        },
        {
            id: 'ai',
            label: 'AI Thu ngân',
            sub: 'Nhân vật AI, bật/tắt, tên',
            icon: <Bot className="size-4" />,
        },
    ]

    return (
        <div className="fixed inset-0 z-50 flex bg-gray-100">

            {/* ── Sidebar ── */}
            <aside className="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white shadow-sm">
                {/* Header */}
                <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-4">
                    <button
                        onClick={onClose}
                        className="flex items-center justify-center rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                    >
                        <ArrowLeft className="size-5" />
                    </button>
                    <span className="text-base font-bold text-gray-900">Cài đặt</span>
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
                    {MENU.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setSection(item.id)}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${section === item.id
                                ? 'bg-brand-muted text-brand'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                        >
                            <span className={`shrink-0 ${section === item.id ? 'text-brand-light' : 'text-gray-400'}`}>
                                {item.icon}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold truncate">{item.label}</p>
                                <p className="text-[10px] text-gray-400 truncate mt-0.5">{item.sub}</p>
                            </div>
                            <ChevronRight className={`size-4 shrink-0 ${section === item.id ? 'text-brand-accent' : 'text-gray-300'}`} />
                        </button>
                    ))}
                </nav>
            </aside>

            {/* ── Content ── */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Sticky section header */}
                <div className="shrink-0 border-b border-gray-200 bg-white/80 backdrop-blur-sm px-8 py-4">
                    <h1 className="text-lg font-black text-gray-900">
                        {MENU.find(m => m.id === section)?.label}
                    </h1>
                </div>

                {/* Scrollable section content */}
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                    <div className="max-w-2xl mx-auto px-8 py-6">
                        {section === 'account' && <AccountSection config={config} />}
                        {section === 'ai' && <AiSection />}

                        {section === 'partners' && (
                            <div className="space-y-8">
                                <div>
                                    <div className="mb-4 flex items-center gap-2">
                                        <img src={shopeeFoodLogo} className="h-6 w-6 object-contain" alt="ShopeeFood" />
                                        <span className="text-sm font-bold text-gray-700">ShopeeFood</span>
                                    </div>
                                    <ShopeeSection />
                                </div>
                                <div>
                                    <div className="mb-4 flex items-center gap-2">
                                        <img src={grabFoodLogo} className="h-6 w-6 object-contain" alt="GrabFood" />
                                        <span className="text-sm font-bold text-gray-700">GrabFood</span>
                                    </div>
                                    <GrabSection />
                                </div>
                            </div>
                        )}

                        {section === 'printer-bill' && (
                            <PrinterSection
                                isBill
                                cfg={billCfg}
                                onChange={setBillCfg}
                                onTest={() => void handleTest(billCfg, 'bill', setBillTestStatus)}
                                onDelete={() => setBillCfg(makeDefaultManual(true))}
                                testStatus={billTestStatus}
                                onSave={() => void handleSave()}
                                saving={saving}
                            />
                        )}

                        {section === 'printer-label' && (
                            <PrinterSection
                                isBill={false}
                                cfg={labelCfg}
                                onChange={setLabelCfg}
                                onTest={() => void handleTest(labelCfg, 'label', setLabelTestStatus)}
                                onDelete={() => setLabelCfg(makeDefaultManual(false))}
                                testStatus={labelTestStatus}
                                onSave={() => void handleSave()}
                                saving={saving}
                            />
                        )}
                    </div>
                </div>
            </main >
        </div >
    )
}

function SpacingSlider({
    label, sub, value, min, max, defaultVal, onChange,
}: {
    label: string; sub?: string; value: number
    min: number; max: number; defaultVal: number
    onChange(v: number): void
}) {
    return (
        <div className="py-3 border-b border-gray-100 last:border-0">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <p className="text-sm font-semibold text-gray-800">{label}</p>
                    {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-bold text-brand w-8 text-right">{value}</span>
                    <button
                        onClick={() => onChange(defaultVal)}
                        className="text-[10px] text-gray-400 hover:text-brand border border-gray-200 rounded px-1.5 py-0.5"
                    >
                        Reset
                    </button>
                </div>
            </div>
            <input
                type="range"
                min={min} max={max} value={value}
                onChange={e => onChange(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-brand"
            />
            <div className="flex justify-between text-[10px] text-gray-300 mt-1">
                <span>{min}</span><span>{max}</span>
            </div>
        </div>
    )
}
