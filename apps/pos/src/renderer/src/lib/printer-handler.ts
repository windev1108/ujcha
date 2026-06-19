import { ipcMain, BrowserWindow } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as os from 'os'
import * as net from 'net'
import * as fs from 'fs'
import * as path from 'path'
import { readSubConfig, writeSubConfig } from '../store/config-store'
import { buildEscPosFromHtml, buildEscPosLabel } from './escpos-builder'

const execAsync = promisify(exec)

type PrinterConnection = 'usb' | 'bluetooth' | 'network'
type PrinterStatus = 'connected' | 'disconnected' | 'connecting' | 'error'

interface DiscoveredPrinter {
    id: string
    name: string
    connection: PrinterConnection
    address?: string
    status: PrinterStatus
}

interface BillConfig {
    enabled: boolean
    printerId: string | null
    paperWidth: number
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

interface LabelConfig {
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
    lineSpacing?: number
    feedAfterCut?: number
    paddingTop?: number
    paddingBottom?: number
}

// ─── In-memory state ──────────────────────────────────────────────────────────
export const connectedPrinters = new Map<string, DiscoveredPrinter>()

// ─── Virtual / software printer filter ───────────────────────────────────────
const VIRTUAL_PRINTER_PATTERNS = [
    /^microsoft\s+(print\s+to\s+pdf|xps\s+document)/i,
    /^fax$/i,
    /^(send\s+to\s+)?onenote/i,
    /^adobe\s+(pdf|acrobat)/i,
    /^foxit/i,
    /^cutepdf/i,
    /^dopdf/i,
    /^pdf24/i,
    /^bullzip/i,
    /^primopdf/i,
    /^nitro\s+pdf/i,
    /^pdfcreator/i,
    /^universal\s+document\s+converter/i,
    /^papercut/i,
]

function isVirtualPrinter(name: string): boolean {
    return VIRTUAL_PRINTER_PATTERNS.some(p => p.test(name))
}

// ─── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_BILL: BillConfig = {
    enabled: true, printerId: null, paperWidth: 58, autoPrint: true,
    copies: 1, showLogo: true, headerText: 'Ujcha Matcha & Coffee',
    footerText: 'Cảm ơn quý khách! Hẹn gặp lại.', showQr: true,
}
const DEFAULT_LABEL: LabelConfig = {
    enabled: false, printerId: null, labelWidth: 50, labelHeight: 30,
    autoPrint: false, showProductName: true, showPrice: true,
    showBarcode: false, showNote: true, customText: '',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function broadcast(channel: string, data: unknown) {
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, data)
}

function isIpAddress(addr: string) { return /^\d{1,3}(\.\d{1,3}){3}$/.test(addr) }
function isComPort(addr: string) { return /^COM\d+$/i.test(addr.trim()) }

function resolvePrinter(printerId: string): DiscoveredPrinter | null {
    const fromMap = connectedPrinters.get(printerId)
    if (fromMap) return fromMap
    const saved = readSubConfig('connectedPrinters') as DiscoveredPrinter[] | null
    const fromDisk = saved?.find(p => p.id === printerId) ?? null
    if (fromDisk) { connectedPrinters.set(printerId, fromDisk); return fromDisk }
    return null
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESC/POS raw byte builder
// ═══════════════════════════════════════════════════════════════════════════════

type EscPosLine =
    | { align: 'center' | 'left'; text: string; bold?: boolean; large?: boolean }
    | { align: 'two-col'; left: string; right: string; bold?: boolean }
    | { align: 'three-col'; qty: string; name: string; price: string }
    | { align: 'separator' }
    | { align: 'qr'; data: string }

// Depth-aware div extractor — handles nested divs correctly.
// Returns only the top-level <div> blocks found directly in `html`.
function extractDivBlocks(html: string): { attrs: string; inner: string }[] {
    const result: { attrs: string; inner: string }[] = []
    const lower = html.toLowerCase()
    let i = 0
    const n = html.length
    while (i < n) {
        const start = lower.indexOf('<div', i)
        if (start === -1) break
        let tagEnd = start + 4
        while (tagEnd < n && html[tagEnd] !== '>') tagEnd++
        if (tagEnd >= n) break
        const attrs = html.slice(start + 4, tagEnd).trim()
        let depth = 1
        let pos = tagEnd + 1
        let innerEnd = -1
        while (pos < n && depth > 0) {
            const o = lower.indexOf('<div', pos)
            const c = lower.indexOf('</div', pos)
            if (c === -1) { pos = n; break }
            if (o !== -1 && o < c) {
                depth++
                let te = o + 4
                while (te < n && html[te] !== '>') te++
                pos = te + 1
            } else {
                depth--
                if (depth === 0) innerEnd = c
                pos = c + 6
            }
        }
        if (innerEnd !== -1) result.push({ attrs, inner: html.slice(tagEnd + 1, innerEnd) })
        i = pos
    }
    return result
}

function buildEscPosQr(data: string): Buffer {
    const bytes = Buffer.from(data, 'utf8')
    const storeLen = bytes.length + 3
    const pL = storeLen & 0xFF
    const pH = (storeLen >> 8) & 0xFF
    return Buffer.concat([
        Buffer.from([0x1B, 0x61, 0x01]),                                                  // center
        Buffer.from([0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]),            // model 2
        Buffer.from([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x04]),                  // module size 4
        Buffer.from([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31]),                  // EC level M
        Buffer.concat([Buffer.from([0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30]), bytes]), // store data
        Buffer.from([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]),                  // print
        Buffer.from([0x1B, 0x61, 0x00]),                                                  // left
    ])
}

function parseReceiptHtmlToLines(html: string): EscPosLine[] {
    const classStyles = new Map<string, string>()
    for (const [, cls, style] of html.matchAll(/\.([a-zA-Z_-][\w-]*)\s*\{([^}]*)\}/g)) {
        classStyles.set(cls, style)
    }

    const resolveStyle = (attrStr: string): string => {
        const inline = attrStr.match(/style="([^"]*)"/i)?.[1] ?? ''
        const cls = attrStr.match(/class="([^"]*)"/i)?.[1] ?? ''
        const fromClass = cls.split(/\s+/).map(c => classStyles.get(c) ?? '').join(';')
        return inline + ';' + fromClass
    }

    const decodeEntities = (s: string) => s
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")

    const stripInner = (s: string) => decodeEntities(
        s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')
    ).trim()

    const lines: EscPosLine[] = []
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    const body = bodyMatch ? bodyMatch[1] : html

    for (const { attrs, inner } of extractDivBlocks(body)) {
        // data-pos="item" marker: qty/name/price encoded directly in attributes — most reliable
        if (/data-pos="item"/.test(attrs)) {
            const qty = attrs.match(/data-qty="([^"]+)"/)?.[1] ?? ''
            const name = decodeEntities(attrs.match(/data-name="([^"]*)"/)?.[1] ?? '')
            const price = decodeEntities(attrs.match(/data-price="([^"]*)"/)?.[1] ?? '')
            if (name || price) lines.push({ align: 'three-col', qty, name, price })
            continue
        }

        const style = resolveStyle(attrs)
        const isEmpty = stripInner(inner).length === 0

        if (/border-top|border-bottom/.test(style) || (isEmpty && /line|separator|divider/i.test(attrs))) {
            lines.push({ align: 'separator' })
            continue
        }

        // img-only div: extract QR data from qrserver.com src
        if (/^\s*<img[^>]*>\s*$/.test(inner)) {
            const src = inner.match(/<img[^>]+src="([^"]+)"/i)?.[1] ?? ''
            const dataParam = src.match(/[?&]data=([^&]*)/i)?.[1]
            if (dataParam) lines.push({ align: 'qr', data: decodeURIComponent(dataParam) })
            continue
        }

        const isCenter = /text-align\s*:\s*center/i.test(style)
        const isFlex = /display\s*:\s*flex/i.test(style) && /justify-content\s*:\s*space-between/i.test(style)
        const isGrid = /display\s*:\s*grid/i.test(style)
        const isBold = /font-weight\s*:\s*bold/i.test(style)
        const isLarge = /font-size\s*:\s*(1[6-9]|[2-9]\d)px/i.test(style)

        if (isGrid) {
            // Fallback: parse nested cells (for grid divs without data-pos marker)
            const cells = extractDivBlocks(inner)
            const qty = cells[0] ? stripInner(cells[0].inner) : ''
            const name = cells[1] ? stripInner(cells[1].inner) : ''
            const price = cells[2] ? stripInner(cells[2].inner) : ''
            if (name || price) lines.push({ align: 'three-col', qty, name, price })
        } else if (isFlex) {
            const spans = [...inner.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)]
            const left = spans[0] ? stripInner(spans[0][1]) : ''
            const right = spans[1] ? stripInner(spans[1][1]) : ''
            if (left || right) lines.push({ align: 'two-col', left, right, bold: isBold })
        } else if (isCenter) {
            const text = stripInner(inner)
            if (text) lines.push({ align: 'center', text, bold: isBold, large: isLarge })
        } else {
            const text = stripInner(inner)
            if (text) lines.push({ align: 'left', text, bold: isBold })
        }
    }

    return lines
}

function buildEscPos(html: string, paperWidthMm: number): Buffer {
    const charWidth = paperWidthMm <= 58 ? 32 : 48
    const chunks: Buffer[] = []

    chunks.push(Buffer.from([0x1B, 0x40]))         // ESC @ — Initialize
    chunks.push(Buffer.from([0x1B, 0x74, 0x00]))   // ESC t 0 — PC437 codepage

    const parsed = parseReceiptHtmlToLines(html)

    for (const line of parsed) {
        if (line.align === 'separator') {
            chunks.push(Buffer.from([0x1B, 0x61, 0x01]))
            chunks.push(latinBuf('-'.repeat(charWidth) + '\n'))
            continue
        }

        if (line.align === 'qr') {
            chunks.push(buildEscPosQr(line.data))
            continue
        }

        if (line.align === 'three-col') {
            const qty = removeDiacritics(line.qty).replace(/\s+/g, '')      // "2x"
            const price = removeDiacritics(line.price)                       // "45.000d"
            const maxName = Math.max(1, charWidth - qty.length - 1 - price.length - 1)
            const name = removeDiacritics(line.name).substring(0, maxName)
            const pad = Math.max(1, charWidth - qty.length - 1 - name.length - price.length)
            chunks.push(Buffer.from([0x1B, 0x61, 0x00]))
            chunks.push(Buffer.from([0x1B, 0x45, 0x01]))
            chunks.push(latinBuf(`${qty} ${name}${' '.repeat(pad)}${price}\n`))
            chunks.push(Buffer.from([0x1B, 0x45, 0x00]))
            continue
        }

        if (line.align === 'two-col') {
            const left = removeDiacritics(line.left)
            const right = removeDiacritics(line.right)
            const gap = Math.max(1, charWidth - left.length - right.length)
            const leftTrunc = left.substring(0, charWidth - right.length - 1)
            chunks.push(Buffer.from([0x1B, 0x61, 0x00]))
            if (line.bold) chunks.push(Buffer.from([0x1B, 0x45, 0x01]))
            chunks.push(latinBuf(leftTrunc + ' '.repeat(gap) + right + '\n'))
            if (line.bold) chunks.push(Buffer.from([0x1B, 0x45, 0x00]))
            continue
        }

        // center or left
        const align = line.align === 'center' ? 0x01 : 0x00
        chunks.push(Buffer.from([0x1B, 0x61, align]))
        if (line.large) chunks.push(Buffer.from([0x1D, 0x21, 0x11]))
        if (line.bold) chunks.push(Buffer.from([0x1B, 0x45, 0x01]))
        chunks.push(latinBuf(removeDiacritics(line.text.substring(0, line.large ? 16 : charWidth)) + '\n'))
        if (line.bold) chunks.push(Buffer.from([0x1B, 0x45, 0x00]))
        if (line.large) chunks.push(Buffer.from([0x1D, 0x21, 0x00]))
    }

    chunks.push(Buffer.from([
        0x1B, 0x64, 0x04,
        0x1D, 0x56, 0x42, 0x00,
    ]))

    return Buffer.concat(chunks)
}

function removeDiacritics(text: string): string {
    return text
        .replace(/₫/g, 'd')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[đĐ]/g, (c) => (c === 'đ' ? 'd' : 'D'))
        .replace(/[^\x20-\x7E]/g, '?')
}

function latinBuf(text: string): Buffer {
    return Buffer.from(text, 'latin1')
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRATEGY 1 — COM port (Bluetooth serial) via PowerShell
// ═══════════════════════════════════════════════════════════════════════════════

async function printViaComPort(comPort: string, data: Buffer): Promise<void> {
    const tmpFile = path.join(os.tmpdir(), `kun-print-${Date.now()}.bin`)
    fs.writeFileSync(tmpFile, data)
    const tmpEscaped = tmpFile.replace(/\\/g, '\\\\')

    try {
        // Method 1: PowerShell SerialPort (most reliable)
        const psScript = [
            `$p = New-Object System.IO.Ports.SerialPort('${comPort}',9600,'None',8,'One')`,
            `$p.WriteTimeout = 5000`,
            `$p.Open()`,
            `$b = [System.IO.File]::ReadAllBytes('${tmpEscaped}')`,
            `$p.Write($b, 0, $b.Length)`,
            `Start-Sleep -Milliseconds 800`,
            `$p.Close()`,
        ].join('; ')

        await execAsync(
            `powershell -NoProfile -NonInteractive -Command "${psScript}"`,
            { timeout: 12000 }
        )
        console.log('[COM] ✅ PowerShell sent', data.length, 'bytes to', comPort)
    } catch (e1) {
        console.warn('[COM] PowerShell failed, trying COPY /B:', e1)
        try {
            await execAsync(`MODE ${comPort} BAUD=9600 PARITY=N DATA=8 STOP=1`, { timeout: 3000 }).catch(() => { })
            await execAsync(`COPY /B "${tmpFile}" ${comPort}`, { timeout: 8000 })
            console.log('[COM] ✅ COPY /B sent to', comPort)
        } catch (e2) {
            throw new Error(`COM print failed — PS: ${String(e1)} | COPY: ${String(e2)}`)
        }
    } finally {
        try { fs.unlinkSync(tmpFile) } catch { /**/ }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRATEGY 2 — TCP/IP (WiFi/LAN) port 9100
// ═══════════════════════════════════════════════════════════════════════════════

function printViaTcp(ip: string, port: number, data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket()
        const timer = setTimeout(() => { socket.destroy(); reject(new Error('TCP timeout')) }, 5000)
        socket.connect(port, ip, () => {
            socket.write(data, err => {
                if (err) { clearTimeout(timer); socket.destroy(); reject(err); return }
                socket.end(() => { clearTimeout(timer); resolve() })
            })
        })
        socket.on('error', err => { clearTimeout(timer); reject(err) })
    })
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRATEGY 3 — Windows named printer (USB) via direct device-file write
//
// WHY winspool RAW still fails:
//   Even with RAW datatype, Windows routes the job through the printer driver's
//   DLL rendering pipeline. GDI-based thermal printer drivers intercept the bytes,
//   try to convert them, produce garbage, and report "success" to the spooler.
//   The printer receives incomprehensible data → stays silent.
//
// FIX: Write directly to the Windows USB device file (e.g. \\.\USB001).
//   This completely bypasses the spooler and driver stack — bytes go straight
//   to the USB endpoint. Same technique used by Epson/Star ESC/POS SDKs on Windows.
// ═══════════════════════════════════════════════════════════════════════════════

async function printRawViaWindowsSpooler(printerName: string, data: Buffer): Promise<void> {
    // Step 1: Find the printer's port name (USB001, USB002, WSD-xxx, etc.)
    let portName = ''
    try {
        const { stdout } = await execAsync(
            `wmic printer where "Name='${printerName.replace(/'/g, "\\'")}'" get PortName /format:list 2>nul`,
            { timeout: 5000 }
        )
        portName = stdout.match(/PortName=(.+)/i)?.[1]?.trim() ?? ''
        console.log('[print-usb] printer:', printerName, '→ port:', portName)
    } catch { /**/ }

    const ts = Date.now()
    const tmpBin = path.join(os.tmpdir(), `kun-raw-${ts}.bin`)
    const tmpPs1 = path.join(os.tmpdir(), `kun-print-${ts}.ps1`)

    fs.writeFileSync(tmpBin, data)
    const binEscaped = tmpBin.replace(/\\/g, '\\\\')

    const printerEscaped = printerName.replace(/'/g, "\\'")

    const runPs = async (script: string): Promise<{ stdout: string; stderr: string }> => {
        fs.writeFileSync(tmpPs1, script, 'utf-8')
        return execAsync(
            `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpPs1}"`,
            { timeout: 15000 }
        )
    }

    // Strategy B script (winspool RAW) — always built, used as fallback or primary for non-USB
    const strategyBScript = `
$bytes = [System.IO.File]::ReadAllBytes('${binEscaped}')
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawPrint {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.Drv", CharSet = CharSet.Ansi, SetLastError = true)]
    public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr d);
    [DllImport("winspool.Drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr h);
    [DllImport("winspool.Drv", CharSet = CharSet.Ansi, SetLastError = true)]
    public static extern Int32 StartDocPrinter(IntPtr h, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.Drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr h);
    [DllImport("winspool.Drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr h);
    [DllImport("winspool.Drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr h);
    [DllImport("winspool.Drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr h, IntPtr p, Int32 n, out Int32 w);
}
"@
\$h = [IntPtr]::Zero
if (-not [RawPrint]::OpenPrinter('${printerEscaped}', [ref]\$h, [IntPtr]::Zero)) {
    throw "Cannot open printer '${printerEscaped}' (error \$([System.Runtime.InteropServices.Marshal]::GetLastWin32Error()))"
}
try {
    \$di = New-Object RawPrint+DOCINFOA
    \$di.pDocName = 'Ujcha Receipt'
    \$di.pDataType = 'RAW'
    \$jobId = [RawPrint]::StartDocPrinter(\$h, 1, \$di)
    if (\$jobId -le 0) { throw "StartDocPrinter failed" }
    [RawPrint]::StartPagePrinter(\$h) | Out-Null
    \$ptr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal(\$bytes.Length)
    try {
        [System.Runtime.InteropServices.Marshal]::Copy(\$bytes, 0, \$ptr, \$bytes.Length)
        \$written = 0
        if (-not [RawPrint]::WritePrinter(\$h, \$ptr, \$bytes.Length, [ref]\$written)) {
            throw "WritePrinter failed (error \$([System.Runtime.InteropServices.Marshal]::GetLastWin32Error()))"
        }
        Write-Output "OK:\$written"
    } finally {
        [System.Runtime.InteropServices.Marshal]::FreeHGlobal(\$ptr)
    }
    [RawPrint]::EndPagePrinter(\$h) | Out-Null
    [RawPrint]::EndDocPrinter(\$h) | Out-Null
} finally {
    [RawPrint]::ClosePrinter(\$h) | Out-Null
}
`

    try {
        if (/^USB\d+$/i.test(portName)) {
            // ── Strategy A: Direct USB device file write ──────────────────────────
            // Bypasses Windows spooler + GDI driver entirely.
            // \\.\USB001 is the Win32 device object for the USB printer port.
            // May fail with Access Denied if spooler holds the port exclusively → fall back to B.
            const strategyAScript = `
$bytes = [System.IO.File]::ReadAllBytes('${binEscaped}')
$stream = New-Object System.IO.FileStream(
    '\\\\.\\${portName}',
    [System.IO.FileMode]::Open,
    [System.IO.FileAccess]::Write,
    [System.IO.FileShare]::ReadWrite
)
try {
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush()
    Write-Output "OK:$($bytes.Length)"
} finally {
    $stream.Dispose()
}
`
            console.log('[print-usb] strategy A: direct device \\\\.\\ ', portName)
            try {
                const { stdout } = await runPs(strategyAScript)
                if (stdout.includes('OK:')) {
                    console.log('[print-usb] ✅ Strategy A:', stdout.trim())
                    return
                }
                console.warn('[print-usb] Strategy A no OK — falling back to B:', stdout.trim())
            } catch (stratAErr) {
                console.warn('[print-usb] Strategy A threw — falling back to B:', String(stratAErr))
            }
        }

        // ── Strategy B: winspool RAW ──────────────────────────────────────────
        // Primary for non-USB ports (WSD, LPT, network); fallback when Strategy A fails.
        console.log('[print-usb] strategy B: winspool RAW (port:', portName || 'unknown', ')')
        const { stdout, stderr } = await runPs(strategyBScript)
        if (!stdout.includes('OK:')) {
            throw new Error(`Print failed: ${stderr?.trim() || stdout?.trim()}`)
        }
        console.log('[print-usb] ✅ Strategy B:', stdout.trim())
    } finally {
        try { fs.unlinkSync(tmpBin) } catch { /**/ }
        try { fs.unlinkSync(tmpPs1) } catch { /**/ }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRATEGY 4 — Windows USB via Electron BrowserWindow.webContents.print()
//
// WHY: printRawViaWindowsSpooler writes raw ESC/POS bytes directly to the USB
//   device, bypassing the Windows driver. For MP583 and similar GDI-based
//   thermal printers, this means the driver never gets to rasterize Unicode
//   text or QR images, so Vietnamese diacritics and QR codes are silent-dropped.
//
// webContents.print() goes through Chrome's layout engine → Windows GDI driver
//   → printer — same pipeline as web printing. Unicode and images render at the
//   printer's native DPI (200–203 DPI on MP583), identical quality to Chrome.
// ═══════════════════════════════════════════════════════════════════════════════

// Serialize print jobs — one hidden window at a time prevents renderer process exhaustion
let _printQueue: Promise<void> = Promise.resolve()

async function printHtmlViaElectronWindow(
    printerName: string,
    html: string,
    pageCss = '@page { size: auto !important; margin: 2mm !important; }',
    paperWidthMm?: number,
): Promise<void> {
    const job = _printQueue.then(() => _doPrint(printerName, html, pageCss, paperWidthMm))
    _printQueue = job.catch(() => { /* keep queue alive on error */ })
    return job
}

async function _doPrint(
    printerName: string,
    html: string,
    pageCss: string,
    paperWidthMm?: number,
): Promise<void> {
    const win = new BrowserWindow({
        show: false,
        x: -9999,
        y: -9999,
        width: 600,
        height: 900,
        frame: false,
        skipTaskbar: true,
        webPreferences: { contextIsolation: true, nodeIntegration: false },
    })
    try {
        const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
        await Promise.race([
            win.loadURL(dataUrl),
            new Promise<void>((_, reject) =>
                setTimeout(() => reject(new Error('loadURL timeout (8s) — renderer process failed to start')), 8000)
            ),
        ])

        // Only insert CSS override when explicitly requested.
        // All bill/label HTML already embed their own @page { size: Xmm auto; margin: 0; }.
        // Overriding with size:auto !important can cause A4 paper size on some GDI drivers → blank output.
        if (pageCss) {
            await win.webContents.insertCSS(pageCss)
        }
        win.show()
        await new Promise(r => setTimeout(r, 400))

        const printOpts: {
            silent: boolean
            deviceName: string
            printBackground: boolean
            pageSize?: { width: number; height: number }
            margins?: { marginType: 'none' }
        } = { silent: true, deviceName: printerName, printBackground: true }

        if (paperWidthMm && paperWidthMm > 0) {
            // Measure actual content height so the GDI driver receives dimensions that match
            // the real receipt length. A fixed 297mm (A4) height causes roll-paper thermal
            // drivers to hold or discard the job because the page height doesn't match their
            // configured paper — the job appears in the queue but no paper comes out.
            let heightMicrons = 297000
            try {
                const scrollPx: number = await win.webContents.executeJavaScript(
                    'document.documentElement.scrollHeight'
                )
                // CSS px → microns: px × (25.4 mm/in ÷ 96 px/in) × 1000 μm/mm + 10 mm bottom buffer
                heightMicrons = Math.ceil((scrollPx * 25.4 / 96 + 10) * 1000)
                console.log('[print] content height:', scrollPx, 'px →', Math.round(heightMicrons / 1000), 'mm')
            } catch {
                console.warn('[print] height measurement failed — using 297mm fallback')
            }
            printOpts.pageSize = { width: paperWidthMm * 1000, height: heightMicrons }
            printOpts.margins = { marginType: 'none' }
        }

        await new Promise<void>((resolve, reject) => {
            // Fallback: callback is unreliable on some Electron/Windows combos — resolve after timeout
            const fallback = setTimeout(() => {
                console.log('[print] callback not received — assuming spooled')
                resolve()
            }, 8000)
            win.webContents.print(
                printOpts,
                (success, failureReason) => {
                    clearTimeout(fallback)
                    if (success) {
                        console.log('[print] ✅ callback confirmed →', printerName)
                        resolve()
                    } else {
                        reject(new Error(failureReason ?? 'Máy in từ chối lệnh in'))
                    }
                },
            )
            console.log('[print] job submitted →', printerName,
                printOpts.pageSize ? `(${printOpts.pageSize.width / 1000}mm × ${printOpts.pageSize.height / 1000}mm)` : '')
        })

        // Brief wait after callback to let the driver finish flushing the buffer
        await new Promise(r => setTimeout(r, 800))
    } finally {
        win.destroy()
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COM PORT DISCOVERY
// KEY FIX: Query registry for the printer's port assignment directly
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Given a Windows printer name (e.g. "XP-58-Win"), find its COM port.
 *
 * Approach 1: WMIC — get PortName for a specific printer by exact name.
 *   This is the most direct: printer driver always registers its port in WMI.
 *
 * Approach 2: Registry — read HKLM\SYSTEM\CurrentControlSet\Control\Print\Printers\{name}\Port
 *
 * Approach 3: Scan all Bluetooth/serial COM ports and try each one.
 */
export async function findComPortForPrinter(printerName: string): Promise<string | null> {
    console.log('[findCOM] Looking for COM port for printer:', printerName)

    // ── Approach 1: WMIC exact match ──────────────────────────────────────────
    try {
        const { stdout } = await execAsync(
            `wmic printer where "Name='${printerName.replace(/'/g, "\\'")}'" get PortName /format:list 2>nul`,
            { timeout: 5000 }
        )
        const match = stdout.match(/PortName=(.+)/i)
        const portName = match?.[1]?.trim()
        console.log('[findCOM] WMIC portName:', portName)

        if (portName && isComPort(portName)) {
            console.log('[findCOM] ✅ Found via WMIC:', portName)
            return portName
        }
    } catch (e) {
        console.warn('[findCOM] WMIC failed:', e)
    }

    // ── Approach 2: Registry read ─────────────────────────────────────────────
    try {
        const regKey = `HKLM\\SYSTEM\\CurrentControlSet\\Control\\Print\\Printers\\${printerName}`
        const { stdout } = await execAsync(
            `reg query "${regKey}" /v Port 2>nul`,
            { timeout: 5000 }
        )
        const match = stdout.match(/Port\s+REG_SZ\s+(.+)/i)
        const portName = match?.[1]?.trim()
        console.log('[findCOM] Registry port:', portName)

        if (portName && isComPort(portName)) {
            console.log('[findCOM] ✅ Found via Registry:', portName)
            return portName
        }
    } catch (e) {
        console.warn('[findCOM] Registry query failed:', e)
    }

    // ── Approach 3: Scan all COM ports, pick Bluetooth ones ──────────────────
    try {
        const { stdout } = await execAsync(
            `wmic path Win32_PnPEntity where "Name like '%(COM%)'" get Name /format:csv 2>nul`,
            { timeout: 6000 }
        )
        console.log('[findCOM] All COM devices:\n', stdout)

        const btPorts: string[] = []
        for (const line of stdout.split('\n')) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.toLowerCase().startsWith('node')) continue
            const comMatch = trimmed.match(/\(COM(\d+)\)/i)
            if (!comMatch) continue
            const com = `COM${comMatch[1]}`
            // Standard Serial over Bluetooth link is the COM port we want
            if (/bluetooth|serial.*link|bt.*link|standard serial/i.test(trimmed)) {
                btPorts.push(com)
                console.log('[findCOM] Bluetooth COM candidate:', com, '←', trimmed)
            }
        }

        // If only one BT port → use it
        if (btPorts.length === 1) {
            console.log('[findCOM] ✅ Single BT COM found:', btPorts[0])
            return btPorts[0]
        }

        // Multiple BT ports → try each by sending ESC @ (init) and checking no error
        if (btPorts.length > 1) {
            console.log('[findCOM] Multiple BT ports, trying each:', btPorts)
            for (const com of btPorts) {
                const reachable = await tryComPort(com)
                if (reachable) {
                    console.log('[findCOM] ✅ Reachable COM:', com)
                    return com
                }
            }
        }
    } catch (e) {
        console.warn('[findCOM] COM scan failed:', e)
    }

    console.warn('[findCOM] ❌ No COM port found for:', printerName)
    return null
}

/** Try opening a COM port briefly to see if it responds */
async function tryComPort(comPort: string): Promise<boolean> {
    try {
        const ps = [
            `$p = New-Object System.IO.Ports.SerialPort('${comPort}',9600,'None',8,'One')`,
            `$p.Open()`,
            `$p.Close()`,
            `Write-Output 'OK'`,
        ].join('; ')
        const { stdout } = await execAsync(
            `powershell -NoProfile -NonInteractive -Command "${ps}"`,
            { timeout: 4000 }
        )
        return stdout.includes('OK')
    } catch {
        return false
    }
}

/**
 * Check if a Windows printer is online via WMIC.
 * PrinterStatus 7 = Offline. WorkOffline = TRUE means user set it offline manually.
 * Returns { online: false, reason } only when we can positively confirm it's offline.
 * On WMIC failure we return online=true to avoid blocking valid prints.
 */
async function checkWindowsPrinterOnline(printerName: string): Promise<{ online: boolean; reason?: string }> {
    try {
        const escaped = printerName.replace(/'/g, "\\'")
        const { stdout } = await execAsync(
            `wmic printer where "Name='${escaped}'" get PrinterStatus,WorkOffline /format:list 2>nul`,
            { timeout: 5000 }
        )
        const workOffline = stdout.match(/WorkOffline=(\w+)/i)?.[1]?.toLowerCase() === 'true'
        const status = parseInt(stdout.match(/PrinterStatus=(\d+)/i)?.[1] ?? '3', 10)
        if (workOffline) return { online: false, reason: `Máy in "${printerName}" đang ở chế độ offline` }
        if (status === 7) return { online: false, reason: `Máy in "${printerName}" không có tín hiệu (offline)` }
        return { online: true }
    } catch {
        return { online: true }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRATEGY — Offscreen image render for COM port (Vietnamese / Unicode support)
//
// Renders the receipt HTML in a hidden Chromium window at screen resolution,
// captures the page as a raw RGBA bitmap, scales horizontally to printer dots,
// and sends via ESC/POS GS v 0 raster command. Supports full Unicode including
// Vietnamese diacritics and ₫ because Chrome handles the font rendering.
// ═══════════════════════════════════════════════════════════════════════════════

async function buildEscPosImageBill(html: string, paperWidthMm: number): Promise<Buffer> {
    // Receipt HTML is designed for 96 DPI CSS layout
    const cssW = Math.round((paperWidthMm - 4) * 96 / 25.4)    // 204px for 58mm

    // Render at 2× zoom: text anti-aliases at ~22px instead of 11px.
    // The captured image is then downscaled to printer dots → crisp result regardless of system DPI.
    const ZOOM = 2
    const renderW = cssW * ZOOM                                   // 408px window

    // Safe printable dot width: 48mm for ≤60mm paper (leaves ~5mm margin total on 58mm)
    const printableMm = paperWidthMm <= 60 ? 48 : Math.round(paperWidthMm - 8)
    const printerW = Math.round(printableMm * 203 / 25.4)        // 384 dots for 48mm
    const bytesPerLine = Math.ceil(printerW / 8)                  // 48 bytes

    // Inject zoom: body lays out at cssW CSS px but renders at 2× visual size to fill renderW.
    // width + margin overrides keep body left-aligned and the correct logical width.
    const modHtml = html.replace('</head>',
        `<style>body{zoom:${ZOOM}!important;width:${cssW}px!important;margin:0!important;}</style></head>`)

    // offscreen: true renders into a virtual buffer — not limited by physical screen height.
    // win.show() is NOT called; that would cap the render buffer to the monitor's pixel height.
    const win = new BrowserWindow({
        show: false,
        width: renderW, height: 1600,
        frame: false, skipTaskbar: true,
        webPreferences: { contextIsolation: true, nodeIntegration: false, offscreen: true },
    })

    try {
        // offscreen mode requires startPainting() to produce frames for capturePage()
        win.webContents.startPainting()

        const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(modHtml)}`
        await Promise.race([
            win.loadURL(dataUrl),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('render timeout')), 8000)),
        ])

        // Wait for external images (QR code from api.qrserver.com) to fully load.
        await Promise.race([
            win.webContents.executeJavaScript(`
                new Promise(resolve => {
                    const imgs = [...document.querySelectorAll('img')]
                    if (!imgs.length) return resolve(null)
                    let done = 0
                    const check = () => { if (++done >= imgs.length) resolve(null) }
                    imgs.forEach(img => {
                        if (img.complete && img.naturalWidth > 0) check()
                        else { img.addEventListener('load', check, {once:true}); img.addEventListener('error', check, {once:true}) }
                    })
                })
            `),
            new Promise(r => setTimeout(r, 5000)),
        ]).catch(() => {})

        // scrollHeight with zoom:ZOOM on body ≈ ZOOM × original CSS height
        let cssDocH = 1600
        try {
            cssDocH = (await win.webContents.executeJavaScript('document.documentElement.scrollHeight')) as number
        } catch { /**/ }

        // Resize offscreen buffer to exact content height, then let the renderer catch up
        const captureH = Math.min(cssDocH + 20, 16000)
        win.setSize(renderW, captureH)
        await new Promise(r => setTimeout(r, 300))

        // capturePage with offscreen: full virtual buffer, no screen-height limit
        const image = await win.webContents.capturePage({ x: 0, y: 0, width: renderW, height: captureH })
        const { width: imgW, height: imgH } = image.getSize()
        const bitmap = image.toBitmap()

        // printerH from original CSS height (before zoom) × DPI ratio 203/96
        // At DPR=1: imgH ≈ cssDocH → scale cssDocH/2 × 2.115 ≈ 1.06 × imgH/2 → downscale ✓
        // At higher DPR: imgH is proportionally larger → even more downscaling → sharper
        const printerH = Math.round((cssDocH / ZOOM) * (203 / 96))

        const lines: Buffer[] = []
        for (let yP = 0; yP < printerH; yP++) {
            const yS = Math.min(Math.floor(yP * imgH / printerH), imgH - 1)
            const row = Buffer.alloc(bytesPerLine, 0x00)
            for (let xP = 0; xP < printerW; xP++) {
                const xS = Math.min(Math.floor(xP * imgW / printerW), imgW - 1)
                const i = (yS * imgW + xS) * 4
                const lum = (bitmap[i] + bitmap[i + 1] + bitmap[i + 2]) / 3
                if (lum < 128) row[xP >> 3] |= 0x80 >> (xP & 7)
            }
            lines.push(row)
        }

        while (lines.length && lines[lines.length - 1].every(b => b === 0)) lines.pop()
        if (!lines.length) throw new Error('Empty receipt render')

        const xL = bytesPerLine & 0xFF
        const xH = (bytesPerLine >> 8) & 0xFF
        const yL = lines.length & 0xFF
        const yH = (lines.length >> 8) & 0xFF

        return Buffer.concat([
            Buffer.from([0x1B, 0x40]),
            Buffer.from([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH]),
            ...lines,
            Buffer.from([0x1B, 0x64, 0x04, 0x1D, 0x56, 0x42, 0x00]),
        ])
    } finally {
        win.destroy()
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SMART PRINT ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * address: COM13 | 192.168.1.100 | "XP-58-Win" (Windows printer name)
 * printerName: Windows printer display name (used for fallback)
 */


function classifyConnection(portName: string, printerName: string): PrinterConnection {
    if (!portName) return 'usb'

    // COM port → bluetooth (serial over BT)
    if (isComPort(portName)) return 'bluetooth'

    // IP address → network/wifi
    if (isIpAddress(portName)) return 'network'

    // USB port patterns: USB001, USB002, USB:vid_...
    if (/^USB/i.test(portName)) return 'usb'

    // WSD port (WiFi Direct / network printer)
    if (/^WSD/i.test(portName)) return 'network'

    // LPT port → usb/local
    if (/^LPT/i.test(portName)) return 'usb'

    // Nếu tên printer chứa "bluetooth" → bluetooth
    if (/bluetooth|BT/i.test(printerName)) return 'bluetooth'

    // Default → usb
    return 'usb'
}

export async function smartPrint(
    address: string,
    printerName: string,
    html: string,
    paperWidthMm: number,
    type: 'bill' | 'label' = 'bill',
    labelSize?: { width: number; height: number },
    spacing?: { lineSpacing?: number; feedAfterCut?: number; paddingTop?: number; paddingBottom?: number },
): Promise<{ ok: boolean; error?: string }> {
    console.log('[smartPrint]', { address, printerName, paperWidthMm, type, labelSize, spacing })

    try {
        if (type !== 'label') {
            const winName = printerName || address

            if (isComPort(address)) {
                // Bluetooth COM port: webContents.print({ deviceName: "COM3" }) silently
                // redirects to the default printer because "COM3" is not a Windows printer name.
                // Always use raw ESC/POS bytes over the serial connection.
                // Vietnamese diacritics are stripped to ASCII on this path.
                console.log('[smartPrint] → bill via COM (image ESC/POS):', address)
                const reachable = await tryComPort(address)
                if (!reachable) throw new Error(`Cổng ${address} không kết nối được — kiểm tra bluetooth/máy in`)
                let escData: Buffer
                try {
                    escData = await buildEscPosImageBill(html, paperWidthMm)
                } catch (imgErr) {
                    console.warn('[smartPrint] Image render failed, falling back to text ESC/POS:', imgErr)
                    escData = buildEscPos(html, paperWidthMm)
                }
                await printViaComPort(address, escData)
            } else {
                // Windows named printer: GDI path via webContents.print().
                // Chrome layout engine handles Unicode (Vietnamese) + QR image rendering.
                console.log('[smartPrint] → bill via GDI (Electron print):', winName)
                const { online, reason } = await checkWindowsPrinterOnline(winName)
                if (!online) throw new Error(reason)
                await printHtmlViaElectronWindow(winName, html, '', paperWidthMm)
            }

        } else if (isComPort(address)) {
            // Label via Bluetooth COM port → image ESC/POS (same as bill, for Vietnamese support)
            console.log('[smartPrint] → label COM (image):', address)
            const reachable = await tryComPort(address)
            if (!reachable) throw new Error(`Cổng ${address} không kết nối được — kiểm tra bluetooth/máy in`)
            let labelEsc: Buffer
            try {
                labelEsc = await buildEscPosImageBill(html, paperWidthMm)
            } catch (imgErr) {
                console.warn('[smartPrint] label image render failed, falling back to text:', imgErr)
                labelEsc = buildEscPosLabel(html, paperWidthMm, spacing)
            }
            await printViaComPort(address, labelEsc)

        } else if (isIpAddress(address)) {
            // Label via WiFi/LAN → TCP 9100 ESC/POS raw
            console.log('[smartPrint] → label TCP:', address)
            await printViaTcp(address, 9100, buildEscPosLabel(html, paperWidthMm, spacing))

        } else {
            // Label via Windows USB — ESC/POS raw bytes written directly to the USB device.
            //
            // address may be a USB port name like "USB001" (returned by getSystemPrinters via WMIC
            // portMap), which is NOT a valid Windows printer name.  printRawViaWindowsSpooler needs
            // the printer display name ("XP-420B") so it can WMIC-look up the real port and open
            // \\.\USB001.  When address looks like a port pattern, fall back to printerName.
            const usbTarget = /^USB\d+$/i.test(address) ? printerName : (address || printerName)
            console.log('[smartPrint] → label USB/raw:', usbTarget)
            await printRawViaWindowsSpooler(usbTarget, buildEscPosLabel(html, paperWidthMm, spacing))
        }

        return { ok: true }
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('[smartPrint] ❌', msg)
        return { ok: false, error: msg }
    }
}

// ─── Test HTML builders ───────────────────────────────────────────────────────
function buildTestBillHtml(headerText: string, footerText: string, paperWidthMm: number): string {
    const w = paperWidthMm - 4
    const baseFontSize = paperWidthMm <= 58 ? 11 : 13
    const shopNameFs = paperWidthMm <= 58 ? 16 : 20
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Kiểm tra máy in</title>
<style>
  @page { size: ${paperWidthMm}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: ${baseFontSize}px; font-weight: bold; margin: 0; padding: 2mm; width: ${w}mm; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .c { text-align: center; } .line { border-top: 1px dashed #000; margin: 5px 0; }
</style></head><body>
<div class="c" style="font-size:${shopNameFs}px;letter-spacing:4px;">${headerText}</div>
<div class="line"></div>
<div class="c">KIỂM TRA MÁY IN ${paperWidthMm}mm</div>
<div>${new Date().toLocaleString('vi-VN')}</div>
<div class="line"></div>
<div>Tiếng Việt: Cà phê sữa đá</div>
<div>Trà sữa Oolong Nướng 45.000đ</div>
<div>Đường: 50% · Đá: Ít · Size: L</div>
<div class="line"></div>
<div class="c">${footerText}</div>
<div style="margin-top:10px"></div>
</body></html>`
}

function buildTestLabelHtml(labelWidthMm: number, labelHeightMm = 30): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Test Nhan</title>
<style>@page{size:${labelWidthMm}mm ${labelHeightMm}mm;margin:0;}body{font-family:sans-serif;margin:0;padding:3px;width:${labelWidthMm}mm;color:#000;}</style>
</head><body>
<p style="font-size:13px;font-weight:bold;margin:0">=== TEST NHAN ===</p>
<p style="font-size:11px;margin:2px 0">Ca phe sua da - Size L</p>
<p style="font-size:11px;font-weight:bold;margin:0">45.000d</p>
<div style="margin-top:6px"></div>
</body></html>`
}

// ─── System printer discovery ─────────────────────────────────────────────────
async function getSystemPrinters(): Promise<DiscoveredPrinter[]> {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return []
    const list = await win.webContents.getPrintersAsync()
    console.log('[printers] system list:', list.map(p => `"${p.name}"`).join(', '))

    // Get port mapping via WMIC
    const portMap = new Map<string, string>()
    try {
        const { stdout } = await execAsync('wmic printer get Name,PortName /format:csv 2>nul', { timeout: 5000 })
        for (const line of stdout.trim().split('\n')) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith('Node')) continue
            const parts = trimmed.split(',')
            if (parts.length < 3) continue
            const portName = parts[parts.length - 1].trim().replace(/:$/, '')
            const name = parts.slice(1, parts.length - 1).join(',').trim()
            if (name && portName) portMap.set(name, portName)
        }
    } catch { /**/ }

    return list
        .filter(p => !isVirtualPrinter(p.name))
        .map(p => {
            const portName = portMap.get(p.name) ?? ''
            const conn = classifyConnection(portName, p.name)
            return {
                id: `system-${p.name}`,
                name: p.name,
                connection: conn,
                address: portName || undefined,
                status: p.status === 0 ? 'connected' as const : 'disconnected' as const,
            }
        })
}

async function discoverAll(): Promise<DiscoveredPrinter[]> {
    const [sys] = await Promise.allSettled([getSystemPrinters()])
    const discovered = sys.status === 'fulfilled' ? sys.value : []

    // For USB printers saved as "connected", verify they are actually online right now.
    // Windows keeps the driver installed permanently, so the printer always shows in
    // getPrintersAsync() even when the USB cable is unplugged.  Without this check,
    // discoverAll() would mark the saved printer as 'connected' forever.
    // BT/network printers are not checked here — they're validated at print time.
    const savedUsbIds = discovered
        .filter(p => connectedPrinters.has(p.id) && p.connection === 'usb')
        .map(p => p.id)

    const usbOnlineSet = new Set<string>()
    if (savedUsbIds.length > 0) {
        await Promise.all(
            discovered
                .filter(p => savedUsbIds.includes(p.id))
                .map(async p => {
                    const { online } = await checkWindowsPrinterOnline(p.name)
                    if (online) usbOnlineSet.add(p.id)
                    else {
                        // Remove from in-memory connected state so status is reflected immediately
                        connectedPrinters.delete(p.id)
                    }
                })
        )
    }

    const all = discovered.map(p => {
        const isSavedConnected = connectedPrinters.has(p.id)
        const isUsbAndOnline = savedUsbIds.includes(p.id) && usbOnlineSet.has(p.id)
        const isNonUsb = isSavedConnected && !savedUsbIds.includes(p.id)
        return {
            ...p,
            status: (isUsbAndOnline || isNonUsb) ? 'connected' as PrinterStatus : p.status,
        }
    })

    const seen = new Set<string>()
    return all.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true })
}

// ─── Scan all COM ports ───────────────────────────────────────────────────────
async function scanAllComPorts(): Promise<{ com: string; name: string; isBluetooth: boolean }[]> {
    const results: { com: string; name: string; isBluetooth: boolean }[] = []
    const seen = new Set<string>()
    try {
        const { stdout } = await execAsync(
            `wmic path Win32_PnPEntity where "Name like '%(COM%)'" get Name /format:csv 2>nul`,
            { timeout: 6000 }
        )
        for (const line of stdout.split('\n')) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.toLowerCase().startsWith('node')) continue
            const m = trimmed.match(/\(COM(\d+)\)/i)
            if (!m) continue
            const com = `COM${m[1]}`
            if (seen.has(com)) continue
            seen.add(com)
            const name = trimmed.split(',').slice(1).join(' ')
                .replace(/\s*\(COM\d+\)/i, '').trim()
            const isBluetooth = /bluetooth|serial.*link|bt.*link|standard serial/i.test(name)
            results.push({ com, name, isBluetooth })
        }
    } catch (e) {
        console.warn('[scanCOM] failed:', e)
    }

    const sorted = results.sort((a, b) =>
        parseInt(a.com.replace(/\D/g, '')) - parseInt(b.com.replace(/\D/g, ''))
    )

    // WMIC lists all paired Bluetooth devices regardless of whether they're currently
    // on and connected. Filter by actually trying to open each BT COM port in parallel —
    // only ports that respond (device is on + in range) are returned.
    const btPorts = sorted.filter(r => r.isBluetooth)
    if (btPorts.length > 0) {
        console.log('[scanCOM] checking reachability for BT ports:', btPorts.map(p => p.com))
        const reachable = await Promise.all(btPorts.map(p => tryComPort(p.com)))
        const reachableSet = new Set(btPorts.filter((_, i) => reachable[i]).map(p => p.com))
        console.log('[scanCOM] reachable BT ports:', [...reachableSet])
        return sorted.filter(r => !r.isBluetooth || reachableSet.has(r.com))
    }

    return sorted
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────
export function registerPrinterHandlers(): void {
    const savedPrinters = readSubConfig('connectedPrinters') as DiscoveredPrinter[] | null
    if (savedPrinters?.length) {
        for (const p of savedPrinters) connectedPrinters.set(p.id, p)
        console.log('[printers] restored:', savedPrinters.map(p => p.name).join(', '))
    }

    ipcMain.handle('printer:discover', async () => {
        try { return await discoverAll() } catch { return [] }
    })

    ipcMain.handle('printer:getSaved', () => readSubConfig('connectedPrinters') ?? [])

    ipcMain.handle('printer:connect', async (_e, id: string) => {
        try {
            const all = await discoverAll()
            const printer = all.find(p => p.id === id)
            if (!printer) return { ok: false, error: 'Không tìm thấy máy in' }
            const printerToSave: DiscoveredPrinter = { ...printer, status: 'connected' }
            connectedPrinters.set(id, printerToSave)
            const saved = readSubConfig('connectedPrinters') as DiscoveredPrinter[] ?? []
            writeSubConfig('connectedPrinters', [...saved.filter(p => p.id !== id), printerToSave])
            broadcast('printer:statusChange', { id, status: 'connected' })
            return { ok: true }
        } catch (e) {
            broadcast('printer:statusChange', { id, status: 'error' })
            return { ok: false, error: String(e) }
        }
    })

    ipcMain.handle('printer:disconnect', (_e, id: string) => {
        connectedPrinters.delete(id)
        const saved = readSubConfig('connectedPrinters') as DiscoveredPrinter[] ?? []
        writeSubConfig('connectedPrinters', saved.filter(p => p.id !== id))
        broadcast('printer:statusChange', { id, status: 'disconnected' })
    })

    ipcMain.handle('printer:testPrint', async (_e, id: string, type: 'bill' | 'label') => {
        const printer = resolvePrinter(id)
        if (!printer) throw new Error(`Máy in chưa kết nối (${id})`)
        const pw = DEFAULT_BILL.paperWidth
        const html = type === 'bill'
            ? buildTestBillHtml(DEFAULT_BILL.headerText, DEFAULT_BILL.footerText, pw)
            : buildTestLabelHtml(50)
        const labelSize = type === 'label' ? { width: 50, height: 30 } : undefined
        return smartPrint(printer.address ?? printer.name, printer.name, html, pw, type, labelSize)
    })

    ipcMain.handle('printer:printBill', async (_e, printerId: string, html: string, copies: number, cfg?: BillConfig) => {
        const printer = resolvePrinter(printerId)
        if (!printer) return { ok: false, error: `Máy in không tìm thấy (${printerId})` }
        const billCfg = cfg ?? DEFAULT_BILL
        try {
            for (let i = 0; i < (copies ?? 1); i++)
                await smartPrint(printer.address ?? printer.name, printer.name, html, billCfg.paperWidth)
            return { ok: true }
        } catch (e) { return { ok: false, error: String(e) } }
    })

    ipcMain.handle('printer:printLabels', async (_e, printerId: string, labels: string[], cfg?: LabelConfig) => {
        const printer = resolvePrinter(printerId)
        if (!printer) return { ok: false, error: `Máy in không tìm thấy (${printerId})` }
        const pw: 58 | 80 = (cfg?.labelWidth ?? 50) >= 70 ? 80 : 58
        try {
            for (const html of labels) await smartPrint(printer.address ?? printer.name, printer.name, html, pw, 'label')
            return { ok: true }
        } catch (e) { return { ok: false, error: String(e) } }
    })

    // ── By-address handlers ────────────────────────────────────────────────────

    ipcMain.handle('printer:testPrintByAddress', async (
        _e, address: string, type: 'bill' | 'label', printerName: string, cfg?: LabelConfig & { paperWidth?: number },
    ) => {
        console.log('[testPrintByAddress]', { address, type, printerName, cfg })
        const pw = cfg?.paperWidth ?? 58
        const labelW = cfg?.labelWidth ?? 50
        const labelH = cfg?.labelHeight ?? 30
        const html = type === 'bill'
            ? buildTestBillHtml('Ujcha Matcha & Coffee', 'Cảm ơn quý khách!', pw)
            : buildTestLabelHtml(labelW, labelH)
        const labelSize = type === 'label' ? { width: labelW, height: labelH } : undefined
        const spacing = type === 'label' && cfg
            ? { lineSpacing: cfg.lineSpacing, feedAfterCut: cfg.feedAfterCut, paddingTop: cfg.paddingTop, paddingBottom: cfg.paddingBottom }
            : undefined
        return smartPrint(address, printerName || address, html, pw, type, labelSize, spacing)
    })

    ipcMain.handle('printer:printBillByAddress', async (
        _e, address: string, printerName: string, html: string, copies: number, cfg?: BillConfig,
    ) => {
        const pw = cfg?.paperWidth ?? 58
        const spacing = cfg ? { lineSpacing: cfg.lineSpacing, feedAfterCut: cfg.feedAfterCut } : undefined
        console.log('[printBillByAddress]', { address, printerName, pw, copies, spacing })
        try {
            for (let i = 0; i < (copies ?? 1); i++)
                await smartPrint(address, printerName || address, html, pw, 'bill', undefined, spacing)
            return { ok: true }
        } catch (e) { return { ok: false, error: String(e) } }
    })

    ipcMain.handle('printer:printLabelsByAddress', async (
        _e, address: string, printerName: string, labels: string[], cfg?: LabelConfig,
    ) => {
        const pw: 58 | 80 = (cfg?.labelWidth ?? 50) >= 70 ? 80 : 58
        const labelSize = cfg?.labelWidth && cfg?.labelHeight
            ? { width: cfg.labelWidth, height: cfg.labelHeight }
            : { width: 50, height: 30 }
        const spacing = cfg ? {
            lineSpacing: cfg.lineSpacing,
            feedAfterCut: cfg.feedAfterCut,
            paddingTop: cfg.paddingTop,
            paddingBottom: cfg.paddingBottom,
        } : undefined

        console.log('[printLabelsByAddress]', { address, printerName, count: labels.length, labelSize, spacing })
        try {
            for (const html of labels)
                await smartPrint(address, printerName || address, html, pw, 'label', labelSize, spacing)
            return { ok: true }
        } catch (e) { return { ok: false, error: String(e) } }
    })

    // ── COM port scan for UI ───────────────────────────────────────────────────
    ipcMain.handle('printer:scanCom', async () => {
        const ports = await scanAllComPorts()
        return ports.map(p => ({ com: p.com, name: p.name, isBluetooth: p.isBluetooth }))
    })

    // ── Diagnostic: resolve COM for a named printer ────────────────────────────
    ipcMain.handle('printer:resolveComPort', async (_e, printerName: string) => {
        const com = await findComPortForPrinter(printerName)
        return { com, found: !!com }
    })
}
