const ESC = 0x1b
const GS = 0x1d

// ─── ESC/POS commands ────────────────────────────────────────────────────────
const CMD = {
    init: () => Buffer.from([ESC, 0x40]),
    codepage: () => Buffer.from([ESC, 0x74, 0x00]),
    utf8: () => Buffer.from([0x1C, 0x43, 0x31]),
    align: (a: 0 | 1 | 2) => Buffer.from([ESC, 0x61, a]),
    bold: (on: boolean) => Buffer.from([ESC, 0x45, on ? 1 : 0]),
    underline: (on: boolean) => Buffer.from([ESC, 0x2d, on ? 1 : 0]),
    doubleHeight: (on: boolean) => Buffer.from([ESC, 0x21, on ? 0x10 : 0x00]),
    fontB: (on: boolean) => Buffer.from([ESC, 0x4D, on ? 1 : 0]),  // Font B: nhỏ hơn Font A
    feed: (n: number) => Buffer.from([ESC, 0x64, n]),
    cut: () => Buffer.from([GS, 0x56, 0x42, 0x00]),
    partialCut: () => Buffer.from([GS, 0x56, 0x42, 0x01]),
    lineSpacing: (n: number) => Buffer.from([ESC, 0x33, Math.max(0, Math.min(255, n))]),
    defaultSpacing: () => Buffer.from([ESC, 0x32]),
}

function stripDiacritics(str: string): string {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\u0111/g, 'd')
        .replace(/\u0110/g, 'D')
        .replace(/[^\x00-\x7F]/g, '?')
}

function vieLn(text: string): Buffer {
    return Buffer.from(text + '\n', 'utf8')
}

// ─── Word wrap helper ─────────────────────────────────────────────────────────
/**
 * Wrap text sang multiple lines theo maxWidth chars.
 * Ưu tiên wrap tại space; nếu không có space thì hard-cut.
 */
function wrapText(text: string, maxWidth: number): string[] {
    if (text.length <= maxWidth) return [text]
    const lines: string[] = []
    let remaining = text
    while (remaining.length > maxWidth) {
        // Tìm vị trí space gần nhất để wrap
        let cutAt = maxWidth
        const lastSpace = remaining.lastIndexOf(' ', maxWidth)
        if (lastSpace > maxWidth * 0.5) cutAt = lastSpace
        lines.push(remaining.slice(0, cutAt).trimEnd())
        remaining = remaining.slice(cutAt).trimStart()
    }
    if (remaining) lines.push(remaining)
    return lines
}

// ─── HTML pre-processor ───────────────────────────────────────────────────────
function extractBody(html: string): string {
    const bodyStartMatch = html.match(/<body[^>]*>/i)
    if (bodyStartMatch && bodyStartMatch.index !== undefined) {
        const contentStart = bodyStartMatch.index + bodyStartMatch[0].length
        const bodyEnd = html.lastIndexOf('</body>')
        if (bodyEnd > contentStart) return html.slice(contentStart, bodyEnd)
        return html.slice(contentStart)
    }
    let s = html
    s = s.replace(/<head\b[\s\S]*?<\/head>/gi, '')
    s = s.replace(/<style\b[\s\S]*?<\/style>/gi, '')
    s = s.replace(/<script\b[\s\S]*?<\/script>/gi, '')
    s = s.replace(/<!DOCTYPE[^>]*>/gi, '')
    s = s.replace(/<\/?html[^>]*>/gi, '')
    return s
}

function innerText(html: string): string {
    let s = html
    s = s.replace(/<style\b[\s\S]*?<\/style>/gi, '')
    s = s.replace(/<script\b[\s\S]*?<\/script>/gi, '')
    s = s.replace(/<br\s*\/?>/gi, ' ')
    s = s.replace(/<[^>]+>/g, '')
    s = s
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#273;/g, 'đ')
        .replace(/&#272;/g, 'Đ')
    return s.replace(/\s+/g, ' ').trim()
}

function getStyle(tag: string): string {
    return tag.match(/style="([^"]*)"/i)?.[1] ?? ''
}

function hasCss(style: string, ...patterns: string[]): boolean {
    const lower = style.toLowerCase().replace(/\s/g, '')
    return patterns.every(p => lower.includes(p.toLowerCase().replace(/\s/g, '')))
}

// ─── PrintLine types ──────────────────────────────────────────────────────────
type PrintLine =
    | { t: 'divider' }
    | { t: 'center'; text: string; bold?: boolean; large?: boolean }
    | { t: 'left'; text: string; bold?: boolean }
    | { t: 'kv'; left: string; right: string; bold?: boolean }
    | { t: 'item'; qty: string; name: string; price: string }
    | { t: 'sub'; text: string }
    | { t: 'blank' }
    | { t: 'qr'; data: string }

function buildEscPosQr(data: string, moduleSize = 5): Buffer {
    const dataBytes = Buffer.from(data, 'utf8')
    const storePayload = dataBytes.length + 3
    const pL = storePayload & 0xFF
    const pH = (storePayload >> 8) & 0xFF
    const sz = Math.min(Math.max(moduleSize, 1), 16)
    return Buffer.concat([
        Buffer.from([GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]),
        Buffer.from([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, sz]),
        Buffer.from([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31]),
        Buffer.from([GS, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30]),
        dataBytes,
        Buffer.from([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]),
    ])
}

// ─── HTML block extractor ─────────────────────────────────────────────────────
interface Block {
    openTag: string
    style: string
    content: string
}

function extractDivBlocks(html: string): Block[] {
    const blocks: Block[] = []
    let i = 0
    while (i < html.length) {
        const start = html.indexOf('<div', i)
        if (start === -1) break
        const tagEnd = html.indexOf('>', start)
        if (tagEnd === -1) break
        const openTag = html.slice(start, tagEnd + 1)
        if (openTag.endsWith('/>')) {
            blocks.push({ openTag, style: getStyle(openTag), content: '' })
            i = tagEnd + 1
            continue
        }
        let depth = 1
        let pos = tagEnd + 1
        while (pos < html.length && depth > 0) {
            const nextOpen = html.indexOf('<div', pos)
            const nextClose = html.indexOf('</div>', pos)
            if (nextClose === -1) break
            if (nextOpen !== -1 && nextOpen < nextClose) {
                depth++
                pos = nextOpen + 4
            } else {
                depth--
                if (depth === 0) {
                    const content = html.slice(tagEnd + 1, nextClose)
                    blocks.push({ openTag, style: getStyle(openTag), content })
                    i = nextClose + 6
                    break
                }
                pos = nextClose + 6
            }
        }
        if (depth > 0) break
    }
    return blocks
}

// ─── Main HTML parser ─────────────────────────────────────────────────────────
function parseHtml(html: string): PrintLine[] {
    const rawBody = extractBody(html)
    // Replace QR <img> tags with sentinel divs so they appear in document order
    const body = rawBody.replace(
        /<img[^>]+src="[^"]*[?&]data=([^&"]+)[^"]*"[^>]*\/?>/gi,
        (_m, encodedData: string) => {
            try {
                const data = decodeURIComponent(encodedData).replace(/"/g, '&quot;')
                return `<div data-qr="${data}"></div>`
            } catch { return '' }
        },
    )
    const result: PrintLine[] = []
    const blocks = extractDivBlocks(body)

    for (const block of blocks) {
        const { style, content, openTag } = block

        // QR code sentinel
        const qrAttr = openTag.match(/data-qr="([^"]*)"/)
        if (qrAttr) {
            result.push({ t: 'qr', data: qrAttr[1].replace(/&quot;/g, '"') })
            continue
        }

        if (
            (hasCss(style, 'border-top') || hasCss(style, 'border-bottom')) &&
            hasCss(style, 'dashed') &&
            !hasCss(style, 'grid') &&
            !hasCss(style, 'flex')
        ) {
            result.push({ t: 'divider' })
            continue
        }
        if (hasCss(style, 'dashed') && !hasCss(style, 'grid') && !hasCss(style, 'flex')) {
            result.push({ t: 'divider' })
            continue
        }

        if (hasCss(style, 'grid-template-columns')) {
            const innerBlocks = extractDivBlocks(content)
            if (innerBlocks.length >= 3) {
                const qty = innerText(innerBlocks[0].content)
                const name = innerText(innerBlocks[1].content)
                const price = innerText(innerBlocks[2].content)
                if (name) result.push({ t: 'item', qty, name, price })
            } else {
                const text = innerText(content)
                if (text) result.push({ t: 'left', text })
            }
            continue
        }

        if (
            (hasCss(style, 'display:flex') || hasCss(style, 'display:flex')) &&
            hasCss(style, 'space-between')
        ) {
            const spans = [...content.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)]
            if (spans.length >= 2) {
                const left = innerText(spans[0][1])
                const right = innerText(spans[spans.length - 1][1])
                const bold =
                    hasCss(style, 'font-weight:bold') ||
                    content.includes('font-weight:bold') ||
                    content.includes('font-weight: bold')
                if (left || right) {
                    result.push({ t: 'kv', left, right, bold })
                    continue
                }
            }
        }

        if (/margin-left\s*:\s*\d+px/i.test(style)) {
            const text = innerText(content)
            if (text) result.push({ t: 'sub', text })
            continue
        }

        const text = innerText(content)
        if (!text) continue

        const isCenter = hasCss(style, 'text-align:center')
        const isBold =
            hasCss(style, 'font-weight:bold') ||
            /letter-spacing/i.test(style)
        const isLarge = /font-size\s*:\s*(1[6-9]|[2-9]\d)px/i.test(style)

        result.push(
            isCenter
                ? { t: 'center', text, bold: isBold, large: isLarge }
                : { t: 'left', text, bold: isBold },
        )
    }

    return result
}

// ─── Spacing config types ─────────────────────────────────────────────────────
export interface LabelSpacingConfig {
    lineSpacing?: number
    feedAfterCut?: number
    paddingTop?: number
    paddingBottom?: number
}

export interface BillSpacingConfig {
    lineSpacing?: number
    feedAfterCut?: number
}

// ─── Bill ESC/POS builder ─────────────────────────────────────────────────────
export function buildEscPosFromHtml(
    html: string,
    paperWidthMm: number,
    spacing?: BillSpacingConfig,
): Buffer {
    const W = paperWidthMm <= 58 ? 32 : 48
    const lines = parseHtml(html)
    const lineSpacingVal = spacing?.lineSpacing ?? 30
    const feedLines = spacing?.feedAfterCut ?? 4

    const out: Buffer[] = [
        CMD.init(),
        CMD.lineSpacing(lineSpacingVal),
    ]

    for (const l of lines) {
        switch (l.t) {
            case 'divider':
                out.push(CMD.align(1), vieLn('-'.repeat(W)))
                break

            case 'center':
                out.push(CMD.align(1))
                if (l.bold) out.push(CMD.bold(true))
                out.push(vieLn(l.text.substring(0, W)))
                if (l.bold) out.push(CMD.bold(false))
                break

            case 'left':
                out.push(CMD.align(0))
                if (l.bold) out.push(CMD.bold(true))
                out.push(vieLn(l.text.substring(0, W)))
                if (l.bold) out.push(CMD.bold(false))
                break

            case 'kv': {
                const maxR = Math.min(l.right.length, Math.floor(W * 0.45))
                const maxL = W - maxR - 1
                const left = l.left.substring(0, maxL)
                const right = l.right.substring(0, maxR)
                const pad = W - left.length - right.length
                out.push(CMD.align(0))
                if (l.bold) out.push(CMD.bold(true))
                out.push(vieLn(left + ' '.repeat(Math.max(1, pad)) + right))
                if (l.bold) out.push(CMD.bold(false))
                break
            }

            case 'item': {
                // FIX: Wrap tên sản phẩm dài thay vì cắt cụt
                // Layout: dòng 1: "[qty] [tên...]   [giá]"
                //         dòng 2+: "      [tên tiếp theo...]"
                const priceStr = l.price
                // Dành tối thiểu 8 chars cho giá, tối đa 12
                const priceWidth = Math.min(Math.max(priceStr.length, 8), 12)
                // Dòng 1: qty + phần đầu tên + giá
                const qtyPrefix = `${l.qty} `
                const nameMaxLine1 = W - qtyPrefix.length - priceWidth - 1
                const nameMaxNext = W - qtyPrefix.length // indent bằng qtyPrefix

                const nameParts = wrapText(l.name, nameMaxLine1)

                out.push(CMD.align(0), CMD.bold(true))

                // Dòng 1: qty + tên (phần đầu) + giá
                const nameLine1 = nameParts[0] ?? ''
                const pad1 = W - qtyPrefix.length - nameLine1.length - priceStr.length
                out.push(vieLn(
                    qtyPrefix + nameLine1 + ' '.repeat(Math.max(1, pad1)) + priceStr
                ))

                // Dòng 2+: indent + phần còn lại của tên (không có giá)
                // Nếu tên quá dài, wrap thêm với indent
                if (nameParts.length > 1) {
                    const remainingName = l.name.slice(nameLine1.length).trim()
                    const continuationLines = wrapText(remainingName, nameMaxNext)
                    for (const contLine of continuationLines) {
                        if (contLine) {
                            out.push(vieLn(' '.repeat(qtyPrefix.length) + contLine))
                        }
                    }
                }

                out.push(CMD.bold(false))
                break
            }

            case 'sub':
                out.push(CMD.align(0))
                out.push(vieLn('+ ' + l.text.substring(0, W - 2)))
                break

            case 'blank':
                out.push(vieLn(''))
                break

            case 'qr':
                out.push(CMD.align(1), CMD.defaultSpacing())
                out.push(buildEscPosQr(l.data))
                out.push(CMD.lineSpacing(lineSpacingVal), CMD.align(0))
                break
        }
    }

    out.push(CMD.defaultSpacing(), CMD.feed(feedLines), CMD.cut())
    return Buffer.concat(out)
}

// ─── Label ESC/POS builder ────────────────────────────────────────────────────
export function buildEscPosLabel(
    html: string,
    paperWidthMm: number,
    spacing?: LabelSpacingConfig,
): Buffer {
    const W = paperWidthMm <= 58 ? 32 : 48
    const lineSpacingVal = spacing?.lineSpacing ?? 18
    const feedLines = spacing?.feedAfterCut ?? 2
    const paddingTop = spacing?.paddingTop ?? 0
    const paddingBottom = spacing?.paddingBottom ?? 0

    const lines = parseHtml(html)
    const out: Buffer[] = [
        CMD.init(),
        CMD.utf8(),
        CMD.fontB(true),
        CMD.lineSpacing(lineSpacingVal),
    ]

    for (let i = 0; i < paddingTop; i++) out.push(vieLn(''))

    let isFirstKv = true

    for (const l of lines) {
        switch (l.t) {
            case 'divider':
                out.push(CMD.align(0), vieLn('-'.repeat(W)))
                break

            case 'center':
                out.push(CMD.align(1))
                if (l.bold) out.push(CMD.bold(true))
                out.push(vieLn(l.text.substring(0, W)))
                if (l.bold) out.push(CMD.bold(false))
                break

            case 'left':
                out.push(CMD.align(0))
                if (l.bold) out.push(CMD.bold(true))
                // FIX: wrap tên sản phẩm trên label cũng
                for (const wrapped of wrapText(l.text, W)) {
                    out.push(vieLn(wrapped))
                }
                if (l.bold) out.push(CMD.bold(false))
                break

            case 'kv': {
                const isBoldKv = isFirstKv || l.bold
                const maxR = Math.min(l.right.length + 1, Math.floor(W * 0.35))
                const maxL = W - maxR
                const left = l.left.substring(0, maxL)
                const right = l.right.substring(0, maxR)
                const pad = W - left.length - right.length
                out.push(CMD.align(0))
                if (isBoldKv) out.push(CMD.bold(true))
                out.push(vieLn(left + ' '.repeat(Math.max(1, pad)) + right))
                if (isBoldKv) out.push(CMD.bold(false))
                isFirstKv = false
                break
            }

            case 'item': {
                const nameStr = `${l.qty} ${l.name}`
                out.push(CMD.align(0), CMD.bold(true))
                for (const wrapped of wrapText(nameStr, W)) {
                    out.push(vieLn(wrapped))
                }
                out.push(CMD.bold(false))
                if (l.price) out.push(vieLn(l.price.substring(0, W)))
                break
            }

            case 'sub':
                out.push(CMD.align(0), vieLn('  ' + l.text.substring(0, W - 2)))
                break

            case 'blank':
                out.push(vieLn(''))
                break
        }
    }

    for (let i = 0; i < paddingBottom; i++) out.push(vieLn(''))

    out.push(CMD.fontB(false), CMD.defaultSpacing(), CMD.feed(feedLines), CMD.partialCut())
    return Buffer.concat(out)
}

// ─── Legacy exports ───────────────────────────────────────────────────────────
export function htmlToLines(html: string): string[] {
    const body = extractBody(html)
    return body
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(div|p|tr|li)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
}

export function removeDiacritics(text: string): string {
    return stripDiacritics(text)
}