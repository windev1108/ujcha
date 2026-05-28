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
    copies: 1, showLogo: true, headerText: 'KUN Matcha & Coffee',
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

function buildEscPos(html: string, paperWidthMm: number): Buffer {
    const charWidth = paperWidthMm <= 58 ? 32 : 48

    const stripHtml = (s: string) => s
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(?:div|p|tr|li|h[1-6])>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'")

    const lines = stripHtml(html)
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)

    const chunks: Buffer[] = []

    // Init + codepage
    chunks.push(Buffer.from([0x1B, 0x40]))         // ESC @ — Initialize
    chunks.push(Buffer.from([0x1B, 0x74, 0x00]))   // ESC t 0 — PC437 codepage

    for (const line of lines) {
        if (/^[-=─━*]+$/.test(line)) {
            chunks.push(Buffer.from([0x1B, 0x61, 0x01]))  // center
            chunks.push(latinBuf('-'.repeat(charWidth) + '\n'))
            continue
        }

        const isBold = line.length < 24 && /[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐƠƯẠ-Ỹ]/.test(line)

        chunks.push(Buffer.from([0x1B, 0x61, 0x01]))  // center
        if (isBold) chunks.push(Buffer.from([0x1B, 0x45, 0x01]))  // bold on

        chunks.push(latinBuf(removeDiacritics(line.substring(0, charWidth)) + '\n'))

        if (isBold) chunks.push(Buffer.from([0x1B, 0x45, 0x00]))  // bold off
    }

    // Feed 4 lines + partial cut
    chunks.push(Buffer.from([
        0x1B, 0x64, 0x04,
        0x1D, 0x56, 0x42, 0x00,
    ]))

    return Buffer.concat(chunks)
}

function removeDiacritics(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, c => c === 'đ' ? 'd' : 'D')
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

    let psScript: string

    if (/^USB\d+$/i.test(portName)) {
        // ── Strategy A: Direct USB device file write ──────────────────────────
        // Bypasses Windows spooler + GDI driver entirely.
        // \\.\USB001 is the Win32 device object for the USB printer port.
        psScript = `
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
        console.log('[print-usb] strategy: direct device \\\\.\\ ', portName)
    } else {
        // ── Strategy B: winspool.drv RAW (fallback for WSD, LPT, network ports) ──
        const printerEscaped = printerName.replace(/'/g, "\\'")
        psScript = `
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
    \$di.pDocName = 'KUN Receipt'
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
        console.log('[print-usb] strategy: winspool RAW (port:', portName || 'unknown', ')')
    }

    fs.writeFileSync(tmpPs1, psScript, 'utf-8')

    try {
        const { stdout, stderr } = await execAsync(
            `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpPs1}"`,
            { timeout: 15000 }
        )
        if (!stdout.includes('OK:')) {
            throw new Error(`Print failed: ${stderr?.trim() || stdout?.trim()}`)
        }
        console.log('[print-usb] ✅', stdout.trim())
    } finally {
        try { fs.unlinkSync(tmpBin) } catch { /**/ }
        try { fs.unlinkSync(tmpPs1) } catch { /**/ }
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
    paperWidthMm: 58 | 80,
    type: 'bill' | 'label' = 'bill',
    labelSize?: { width: number; height: number },
    spacing?: { lineSpacing?: number; feedAfterCut?: number; paddingTop?: number; paddingBottom?: number },
): Promise<{ ok: boolean; error?: string }> {
    console.log('[smartPrint]', { address, printerName, paperWidthMm, type, labelSize, spacing })

    try {
        if (isComPort(address)) {
            // Bluetooth COM port → ESC/POS raw
            const escData = type === 'label'
                ? buildEscPosLabel(html, paperWidthMm, spacing)
                : buildEscPosFromHtml(html, paperWidthMm, spacing)
            await printViaComPort(address, escData)

        } else if (isIpAddress(address)) {
            // WiFi/LAN → TCP 9100 ESC/POS raw
            const escData = type === 'label'
                ? buildEscPosLabel(html, paperWidthMm, spacing)
                : buildEscPosFromHtml(html, paperWidthMm, spacing)
            await printViaTcp(address, 9100, escData)

        } else {
            // Windows printer name (USB) → raw ESC/POS via winspool.drv spooler
            const targetPrinter = address || printerName
            console.log('[smartPrint] → USB/Windows printer (raw spooler):', targetPrinter)

            const escData = type === 'label'
                ? buildEscPosLabel(html, paperWidthMm, spacing)
                : buildEscPosFromHtml(html, paperWidthMm, spacing)
            await printRawViaWindowsSpooler(targetPrinter, escData)
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
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Test Hoa don</title>
<style>
  @page { size: ${paperWidthMm}mm auto; margin: 0; }
  body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 2mm; width: ${paperWidthMm - 4}mm; color: #000; }
  .c { text-align: center; } .line { border-top: 1px dashed #000; margin: 4px 0; }
</style></head><body>
<div class="c"><b>${headerText}</b></div>
<div class="line"></div>
<div class="c">=== TEST IN HOA DON ===</div>
<div>Kho giay: ${paperWidthMm}mm</div>
<div>Thoi gian: ${new Date().toLocaleString('vi-VN')}</div>
<div class="line"></div>
<div class="c">${footerText}</div>
<div style="margin-top:8px"></div>
</body></html>`
}

function buildTestLabelHtml(labelWidthMm: number): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Test Nhan</title>
<style>@page{size:${labelWidthMm}mm auto;margin:0;}body{font-family:sans-serif;margin:0;padding:3px;width:${labelWidthMm}mm;color:#000;}</style>
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
    const all = (sys.status === 'fulfilled' ? sys.value : []).map(p => ({
        ...p,
        status: connectedPrinters.has(p.id) ? 'connected' as PrinterStatus : p.status,
    }))
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
    return results.sort((a, b) =>
        parseInt(a.com.replace(/\D/g, '')) - parseInt(b.com.replace(/\D/g, ''))
    )
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
        const html = type === 'bill'
            ? buildTestBillHtml(DEFAULT_BILL.headerText, DEFAULT_BILL.footerText, DEFAULT_BILL.paperWidth)
            : buildTestLabelHtml(50)
        return smartPrint(printer.address ?? printer.name, printer.name, html, DEFAULT_BILL.paperWidth)
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
        _e, address: string, type: 'bill' | 'label', printerName: string,
    ) => {
        console.log('[testPrintByAddress]', { address, type, printerName })
        const pw: 58 | 80 = 58
        const html = type === 'bill'
            ? buildTestBillHtml('KUN Matcha & Coffee', 'Cam on quy khach!', pw)
            : buildTestLabelHtml(50)
        return smartPrint(address, printerName || address, html, pw)
    })

    ipcMain.handle('printer:printBillByAddress', async (
        _e, address: string, printerName: string, html: string, copies: number, cfg?: BillConfig,
    ) => {
        const pw = cfg?.paperWidth ?? 58
        const spacing = cfg ? { lineSpacing: cfg.lineSpacing, feedAfterCut: cfg.feedAfterCut } : undefined
        console.log('[printBillByAddress]', { address, printerName, pw, copies, spacing })
        try {
            for (let i = 0; i < (copies ?? 1); i++)
                await smartPrint(address, printerName || address, html, pw as 58 | 80, 'bill', undefined, spacing)
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