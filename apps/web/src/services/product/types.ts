export interface ApiTopping {
  id: string
  name: string
  price: string
}

export interface ApiProduct {
  id: string
  name: string
  slug: string
  sku: string | null
  description: string | null
  price: string
  imageUrls: string[]
  optionGroups: { id: string; name: string; values: (string | { label: string; priceDelta?: number })[] }[]
  isAvailable: boolean
  isSoldOut: boolean
  discountPercent: number
  category: { id: string; name: string; slug: string; thumbnail: string | null }
}
