export const KEYS = {
    bill: 'kun-pos:billConfig',
    label: 'kun-pos:labelConfig',
}

export function loadLocal<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key)
        return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
    } catch { return fallback }
}

export function saveLocal(key: string, value: unknown) {
    try { localStorage.setItem(key, JSON.stringify(value)) }
    catch (e) { console.error('localStorage save failed:', e) }
}