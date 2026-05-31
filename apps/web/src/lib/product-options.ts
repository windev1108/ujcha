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
      values,
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

export function formatVnd(amount: number | string) {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ'
}
