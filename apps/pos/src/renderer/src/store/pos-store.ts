import { create } from 'zustand'
import type { CartItem, Category, PosConfig, Product, Table, PaymentConfig } from '../types/common'
import { DEFAULT_CONFIG } from '../types/common'

interface PosState {
  // Config / Auth
  posConfig: PosConfig
  isLoggedIn: boolean
  isFetching: boolean
  setPosConfig: (cfg: PosConfig) => void
  logout: () => void

  // Data cache
  categories: Category[]
  products: Product[]
  tables: Table[]
  paymentConfig: PaymentConfig | null
  setCategories: (v: Category[]) => void
  setProducts: (v: Product[]) => void
  setIsFetching: (v: boolean) => void
  setTables: (v: Table[]) => void
  setPaymentConfig: (v: PaymentConfig) => void

  // POS Session
  selectedCategoryId: string | null
  setSelectedCategoryId: (id: string | null) => void
  searchQuery: string
  setSearchQuery: (q: string) => void

  // Cart
  cart: CartItem[]
  selectedTableId: string | null
  orderNote: string
  addToCart: (item: Omit<CartItem, 'cartId'>) => void
  removeFromCart: (cartId: string) => void
  updateQty: (cartId: string, qty: number) => void
  updateNote: (cartId: string, note: string) => void
  setSelectedTable: (id: string | null) => void
  setOrderNote: (note: string) => void
  clearCart: () => void
  cartTotal: () => number

  // UI
  view: 'pos' | 'orders'
  setView: (v: 'pos' | 'orders') => void
  showOrders: boolean
  setShowOrders: (v: boolean) => void
}

export const usePosStore = create<PosState>((set, get) => ({
  // ── Config ────────────────────────────────────────────────────────────────
  posConfig: { ...DEFAULT_CONFIG },
  isLoggedIn: false,
  setPosConfig: (cfg) =>
    set({ posConfig: cfg, isLoggedIn: !!cfg.accessToken && !!cfg.adminUser }),
  logout: () =>
    set({ posConfig: { ...DEFAULT_CONFIG }, isLoggedIn: false, cart: [], selectedTableId: null }),

  // ── Data ──────────────────────────────────────────────────────────────────
  categories: [],
  products: [],
  tables: [],
  paymentConfig: null,
  isFetching: false,
  setCategories: (categories) => set({ categories }),
  setProducts: (products) => set({ products }),
  setIsFetching: (isFetching) => set({ isFetching }),
  setTables: (tables) => set({ tables }),
  setPaymentConfig: (paymentConfig) => set({ paymentConfig }),

  // ── POS Session ───────────────────────────────────────────────────────────
  selectedCategoryId: null,
  setSelectedCategoryId: (selectedCategoryId) => set({ selectedCategoryId }),
  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  // ── Cart ──────────────────────────────────────────────────────────────────
  cart: [],
  selectedTableId: null,
  orderNote: '',
  addToCart: (item) => {
    const key = (i: Omit<CartItem, 'cartId'>) => {
      const opts = Object.entries(i.options ?? {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join('|')
      const extras = [...(i.extras ?? [])].map(e => e.id).sort().join(',')
      return `${i.productId}__${opts}__${extras}__${(i.note ?? '').trim()}`
    }
    set((s) => {
      const newKey = key(item)
      const idx = s.cart.findIndex(c => key(c) === newKey)
      if (idx !== -1) {
        const cart = [...s.cart]
        cart[idx] = { ...cart[idx], quantity: cart[idx].quantity + item.quantity }
        return { cart }
      }
      return { cart: [...s.cart, { ...item, cartId: crypto.randomUUID() }] }
    })
  },
  removeFromCart: (cartId) =>
    set((s) => ({ cart: s.cart.filter((i) => i.cartId !== cartId) })),
  updateQty: (cartId, qty) =>
    set((s) => ({
      cart:
        qty <= 0
          ? s.cart.filter((i) => i.cartId !== cartId)
          : s.cart.map((i) => (i.cartId === cartId ? { ...i, quantity: qty } : i)),
    })),
  updateNote: (cartId, note) =>
    set((s) => ({
      cart: s.cart.map((i) => (i.cartId === cartId ? { ...i, note } : i)),
    })),
  setSelectedTable: (selectedTableId) => set({ selectedTableId }),
  setOrderNote: (orderNote) => set({ orderNote }),
  clearCart: () => set({ cart: [], selectedTableId: null, orderNote: '' }),
  cartTotal: () => {
    const { cart } = get()
    return cart.reduce((sum, item) => {
      const extrasTotal = (item.extras ?? []).reduce((s, e) => s + (e.price ?? 0), 0)
      return sum + (item.basePrice + item.optionDelta + extrasTotal) * item.quantity
    }, 0)
  },

  // ── UI ────────────────────────────────────────────────────────────────────
  view: 'pos',
  setView: (view) => set({ view }),
  showOrders: false,
  setShowOrders: (showOrders) => set({ showOrders }),
}))
