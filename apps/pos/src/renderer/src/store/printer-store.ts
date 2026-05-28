import { useSyncExternalStore } from 'react'
import type { DiscoveredPrinter } from '../../../preload/index'

const eAPI = (window as unknown as {
    electronAPI?: import('../../../preload/index').ElectronAPI
}).electronAPI

// ─── Internal state ───────────────────────────────────────────────────────────

interface PrinterState {
    printers: DiscoveredPrinter[]
    discovering: boolean
}

let state: PrinterState = { printers: [], discovering: false }
const listeners = new Set<() => void>()

function setState(patch: Partial<PrinterState>) {
    state = { ...state, ...patch }
    listeners.forEach((fn) => fn())
}

// ─── useSyncExternalStore plumbing ────────────────────────────────────────────

function subscribe(fn: () => void) {
    listeners.add(fn)
    return () => listeners.delete(fn)
}

function getSnapshot(): PrinterState {
    return state
}

/** Hook để dùng trong React components */
export function usePrinterStore() {
    return useSyncExternalStore(subscribe, getSnapshot)
}

/** Lấy state ngoài React (ví dụ trong handler functions) */
export function getPrinterState() {
    return state
}

// ─── Actions ──────────────────────────────────────────────────────────────────

let initialized = false
let cleanupStatusListener: (() => void) | null = null

/**
 * Gọi đúng 1 lần tại App entry point.
 * - Load saved printers từ disk ngay lập tức (fast path, không chờ scan)
 * - Sau đó discover background để cập nhật danh sách đầy đủ
 * - Đăng ký listener realtime status change từ main process
 */
export async function initPrinterStore(): Promise<void> {
    if (initialized) return
    initialized = true

    // Fast path: hiển thị saved/connected printers ngay, không chờ scan
    if (eAPI?.printer) {
        const saved = await eAPI.printer.getSaved()
        if (saved.length) setState({ printers: saved })
    }

    // Background discover — không block UI
    void discoverPrinters()

    // Realtime: main process broadcast khi có thay đổi
    cleanupStatusListener?.()
    cleanupStatusListener =
        eAPI?.printer.onStatusChange(({ id, status }) => {
            setState({
                printers: state.printers.map((p) => (p.id === id ? { ...p, status } : p)),
            })
        }) ?? null
}

export async function discoverPrinters(): Promise<void> {
    if (state.discovering) return
    setState({ discovering: true })

    try {
        if (eAPI?.printer) {
            const found = await eAPI.printer.discover()
            const currentMap = new Map(state.printers.map((p) => [p.id, p]))
            const merged = found.map((p) => ({
                ...p,
                status: currentMap.get(p.id)?.status ?? p.status,
            }))

            setState({ printers: merged })
        } else {
            // Dev/web fallback
            await new Promise((r) => setTimeout(r, 800))
            setState({
                printers: [
                    { id: 'usb-001', name: 'EPSON TM-T82X', connection: 'usb', address: '/dev/usb/lp0', status: 'connected' },
                    { id: 'bt-001', name: 'ZJ-5802 BT', connection: 'bluetooth', address: 'AA:BB:CC:DD:EE:FF', status: 'disconnected' },
                    { id: 'net-001', name: 'Star TSP143 LAN', connection: 'network', address: '192.168.1.105', status: 'disconnected' },
                ],
            })
        }
    } catch {
        // Giữ nguyên danh sách cũ nếu discover thất bại
    } finally {
        setState({ discovering: false })
    }
}

export async function connectPrinter(id: string): Promise<{ ok: boolean; error?: string }> {
    setState({
        printers: state.printers.map((p) => (p.id === id ? { ...p, status: 'connecting' } : p)),
    })
    try {
        const res = eAPI?.printer
            ? await eAPI.printer.connect(id)
            : await new Promise<{ ok: boolean }>((r) => setTimeout(() => r({ ok: true }), 900))

        setState({
            printers: state.printers.map((p) =>
                p.id === id ? { ...p, status: res.ok ? 'connected' : 'error' } : p,
            ),
        })
        return res
    } catch (e) {
        setState({
            printers: state.printers.map((p) => (p.id === id ? { ...p, status: 'error' } : p)),
        })
        return { ok: false, error: String(e) }
    }
}

export async function disconnectPrinter(id: string): Promise<void> {
    if (eAPI?.printer) await eAPI.printer.disconnect(id)
    setState({
        printers: state.printers.map((p) =>
            p.id === id ? { ...p, status: 'disconnected' } : p,
        ),
    })
}

export async function testPrint(id: string, type: 'bill' | 'label'): Promise<void> {
    if (eAPI?.printer) await eAPI.printer.testPrint(id, type)
    else await new Promise((r) => setTimeout(r, 700))
}