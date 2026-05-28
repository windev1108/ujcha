export interface ApiCartProduct {
  id: string
  name: string
  slug: string
  price: string
  imageUrls: string[]
  discountPercent: number
  optionGroups: { id: string; name: string; values: (string | { label: string; priceDelta?: number })[] }[]
  category: { name: string }
}

export interface ApiCartTopping {
  toppingId: string
  topping: { id: string; name: string; price: string }
}

export interface ApiCartItem {
  id: string
  cartId: string
  productId: string
  quantity: number
  selectedOptions: Record<string, string>
  toppings: ApiCartTopping[]
  product: ApiCartProduct
}

export interface ApiCart {
  id: string
  userId: string
  items: ApiCartItem[]
}
