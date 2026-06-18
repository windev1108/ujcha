export interface ApiCartProduct {
  id: string
  name: string
  nameTranslation?: Record<string, string>
  slug: string
  price: string
  imageUrls: string[]
  discountPercent: number
  finalPrice: number
  optionGroups: { id: string; name: string; nameTranslation?: Record<string, string>; values: (string | { label: string; priceDelta?: number; nameTranslation?: Record<string, string> })[] }[]
  toppings?: Array<{ id: string; name: string; nameTranslation?: Record<string, string>; price: number; isActive: boolean }>
  category: { name: string; nameTranslation?: Record<string, string> }
}

export interface ApiCartTopping {
  toppingId: string
  topping: { id: string; name: string; price: string; nameTranslation?: Record<string, string> }
}

export interface ApiCartItem {
  id: string
  cartId: string
  productId: string
  quantity: number
  selectedOptions: Record<string, string>
  toppings: ApiCartTopping[]
  product: ApiCartProduct
  note?: string | null
}

export interface ApiCart {
  id: string
  userId: string
  items: ApiCartItem[]
}
