const eAPI = (window as any).electronAPI as import('../../../preload').ElectronAPI | undefined

let cached: string | null = null

export async function getFontBase64(): Promise<string> {
    if (cached !== null) return cached
    cached = await eAPI?.font?.getBase64() ?? ''
    return cached ?? ''
}

export function getFontFaceStyle(base64: string): string {
    if (!base64) return ''
    return `@font-face {
    font-family: 'JetBrains Mono';
    src: url('${base64}') format('truetype');
    font-weight: 700;
  }`
}

export const FONT_FAMILY = `'JetBrains Mono', 'Courier New', monospace`
export const FONT_SMOOTHING = `-webkit-font-smoothing: none; text-rendering: optimizeSpeed;`