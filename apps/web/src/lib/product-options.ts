export interface ProductOptionValue {
  label: string
  priceDelta: number
}

export interface ProductOptionGroup {
  id: string
  name: string
  values: ProductOptionValue[]
}

/** Normalise raw JSON (string[] or {label,priceDelta}[]) → ProductOptionGroup[]. */
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
          const label = String((x as { label: unknown }).label).trim()
          if (!label) continue
          const pd = (x as { priceDelta?: unknown }).priceDelta
          const priceDelta =
            pd !== undefined && pd !== null && pd !== ''
              ? Math.max(0, Math.round(Number(pd) * 100) / 100)
              : 0
          values.push({ label, priceDelta: Number.isFinite(priceDelta) ? priceDelta : 0 })
        }
      }
    }
    return {
      id: typeof o.id === 'string' ? o.id : `g-${i}`,
      name: typeof o.name === 'string' ? o.name : '',
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
