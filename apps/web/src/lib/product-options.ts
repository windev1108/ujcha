export interface ProductOptionValue {
  label: string
  priceDelta: number
  nameTranslation?: Record<string, string>
}

export interface ProductOptionGroup {
  id: string
  name: string
  nameTranslation?: Record<string, string>
  selectionMin?: number
  selectionMax?: number
  values: ProductOptionValue[]
}

const NORMAL_KEYWORDS = ['bình thường', 'vừa']

/**
 * Sort option values: cheapest first (priceDelta asc), with "bình thường"/"vừa"
 * floated to the top when prices are equal.
 */
export function sortOptionValues(values: ProductOptionValue[]): ProductOptionValue[] {
  const isNormal = (v: ProductOptionValue) => {
    const check = (s: string) => NORMAL_KEYWORDS.some((kw) => s.toLowerCase().includes(kw))
    return check(v.label) || Object.values(v.nameTranslation ?? {}).some(check)
  }
  return [...values].sort((a, b) => {
    if (a.priceDelta !== b.priceDelta) return a.priceDelta - b.priceDelta
    const an = isNormal(a), bn = isNormal(b)
    return an === bn ? 0 : an ? -1 : 1
  })
}

/** Normalise raw JSON from API → ProductOptionGroup[], preserving nameTranslation. */
export function normalizeOptionGroups(raw: unknown): ProductOptionGroup[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item, i) => {
    if (!item || typeof item !== 'object') {
      return { id: `g-${i}`, name: '', values: [] }
    }
    const o = item as Record<string, unknown>
    const values: ProductOptionValue[] = []
    if (Array.isArray(o.values)) {
      for (const x of o.values) {
        if (typeof x === 'string') {
          if (x.trim()) values.push({ label: x.trim(), priceDelta: 0 })
        } else if (x && typeof x === 'object' && 'label' in x) {
          const v = x as Record<string, unknown>
          const label = String(v.label ?? '').trim()
          if (!label) continue
          const pd = v.priceDelta
          const priceDelta =
            pd !== undefined && pd !== null && pd !== ''
              ? Math.max(0, Math.round(Number(pd) * 100) / 100)
              : 0
          const nt = v.nameTranslation && typeof v.nameTranslation === 'object'
            ? (v.nameTranslation as Record<string, string>)
            : undefined
          values.push({ label, priceDelta: Number.isFinite(priceDelta) ? priceDelta : 0, ...(nt ? { nameTranslation: nt } : {}) })
        }
      }
    }
    const nt = o.nameTranslation && typeof o.nameTranslation === 'object'
      ? (o.nameTranslation as Record<string, string>)
      : undefined
    return {
      id: typeof o.id === 'string' ? o.id : `g-${i}`,
      name: typeof o.name === 'string' ? o.name : '',
      ...(nt ? { nameTranslation: nt } : {}),
      ...(typeof o.selectionMin === 'number' ? { selectionMin: o.selectionMin } : {}),
      ...(typeof o.selectionMax === 'number' ? { selectionMax: o.selectionMax } : {}),
      values: sortOptionValues(values),
    }
  })
}

/** Price surcharge from selected option values. */
export function computeOptionSurcharge(
  groups: ProductOptionGroup[],
  options: Record<string, string>,
): number {
  let add = 0
  for (const g of groups) {
    const sel = options[g.name]?.trim()
    if (!sel) continue
    const v = g.values.find((v) => v.label === sel)
    if (v && Number.isFinite(v.priceDelta)) add += Math.max(0, v.priceDelta)
  }
  return Math.round(add * 100) / 100
}

/**
 * Formats an option key+value pair using the same display rules as the POS label printer:
 * - Groups containing "size", "đá", "kích cỡ", "chọn ly" → hide key, show value only
 * - Groups containing "ngọt" → show as "Ngọt {value}"
 * - Values containing "sữa"/"đường" + "không" → "Ít Ngọt"
 * - Values containing "sữa"/"đường" without "không" → "Ngọt vừa"
 * - Otherwise → "{key}: {value}"
 */
/**
 * Formats an option value for display, following the same rules as the POS label printer.
 * Always shows only the value (key is never shown). Special cases:
 * - Key contains "ngọt" → prepend "Ngọt " if value doesn't already include it
 * - Value contains "sữa"/"đường" + "không" → "Ít Ngọt"
 * - Value contains "sữa"/"đường" without "không" → "Ngọt vừa"
 * - Otherwise → value as-is
 */
export function formatOptionLabel(key: string, value: string, locale = 'vi'): string {
  if (key.trim().toLowerCase() === 'mức độ ngọt' && value.trim().toLowerCase() === 'bình thường') {
    return locale === 'en' ? 'Normal sweetness' : 'Ngọt bình thường'
  }
  return value
}

export function formatVnd(amount: number | string) {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ'
}
