type WithTranslation = { name: string; nameTranslation?: Record<string, string> | null }
type ValueWithTranslation = { label: string; nameTranslation?: Record<string, string> | null }
type WithDescription = { description?: string | null; descriptionTranslation?: Record<string, string> | null }

function pickTranslation(nt: Record<string, string> | null | undefined, locale: string): string | undefined {
  if (!nt || !locale || locale === 'vi') return undefined
  return nt[locale]?.trim() || undefined
}

/** Product, category, option group, or topping name in the given locale. */
export function getDisplayName(item: WithTranslation, locale: string): string {
  return pickTranslation(item.nameTranslation, locale) ?? item.name
}

/** Option value label in the given locale. */
export function getValueLabel(value: ValueWithTranslation, locale: string): string {
  return pickTranslation(value.nameTranslation, locale) ?? value.label
}

/** Product description in the given locale; returns null when no description exists. */
export function getDisplayDescription(item: WithDescription, locale: string): string | null {
  return pickTranslation(item.descriptionTranslation, locale) ?? item.description ?? null
}
