export interface ApiTopping {
  id: string
  name: string
  price: string
}

export type ProductTopping = {
  id: string
  name: string
  nameTranslation?: Record<string, string>
  price: number
  isActive: boolean
}

export type ProductOptionValue = {
  label: string
  priceDelta: number
  nameTranslation?: Record<string, string>
}

export type ProductOptionGroup = {
  id: string
  name: string
  nameTranslation?: Record<string, string>
  selectionMin: number
  selectionMax: number
  values: ProductOptionValue[]
}

export interface ApiProduct {
  id: string
  name: string
  /** Bản dịch tên món: { "en": "...", "ko": "..." } */
  nameTranslation: Record<string, string>
  /** Bản dịch mô tả món: { "en": "...", "ko": "..." } */
  descriptionTranslation: Record<string, string>
  slug: string
  sku: string | null
  description: string | null
  price: string
  imageUrls: string[]
  optionGroups: ProductOptionGroup[]
  toppings: ProductTopping[]
  isAvailable: boolean
  isSoldOut: boolean
  discountPercent: number
  finalPrice: number
  category: { id: string; name: string; nameTranslation?: Record<string, string>; slug: string; thumbnail: string | null }
}
