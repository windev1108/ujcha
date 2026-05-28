export interface AiMenuItem {
  id: string
  name: string
  category: string
  price: number
  imageUrl: string | null
  options: { name: string; values: { label: string; priceDelta: number }[] }[]
  isAvailable: boolean
  isSoldOut: boolean
}

export interface AiCartItem {
  productId: string
  name: string
  basePrice: number
  imageUrl: string | null
  quantity: number
  options: Record<string, string>
  optionDetails: { group: string; label: string; priceDelta: number }[]
  optionDelta: number
  extras: { id: string; name: string; price: number }[]
  note: string
}

export interface AgentRunParams {
  sessionId: string
  userMessage: string
  apiKey: string
  model: string
  apiBaseUrl: string
  accessToken: string
  aiName?: string
  onChunk: (text: string) => void
  onAddToCart: (items: AiCartItem[]) => void
  onUpdateCartItem: (position: number, qty: number) => void
  onCheckout: (paymentMethod: 'cash' | 'transfer') => void
  onDone: () => void
  onError: (err: string) => void
}
