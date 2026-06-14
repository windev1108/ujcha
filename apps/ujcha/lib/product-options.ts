import type { ProductOptionGroup } from '@/types'

export function computeOptionSurcharge(
  optionGroups: ProductOptionGroup[],
  selectedOptions: Record<string, string>,
): number {
  let total = 0
  for (const group of optionGroups) {
    const selected = selectedOptions[group.name]
    if (!selected) continue
    const val = group.values.find((v) => v.label === selected)
    if (val) total += val.priceDelta
  }
  return total
}

export function defaultOptions(optionGroups: ProductOptionGroup[]): Record<string, string> {
  const opts: Record<string, string> = {}
  for (const group of optionGroups) {
    if (group.selectionMin > 0 && group.values.length > 0) {
      opts[group.name] = group.values[0].label
    }
  }
  return opts
}

export function itemKey(
  productId: string,
  selectedOptions: Record<string, string>,
  toppingIds: string[],
): string {
  const opts = JSON.stringify(
    Object.fromEntries(Object.entries(selectedOptions).sort()),
  )
  return [productId, opts, [...toppingIds].sort().join(',')].join('||')
}
