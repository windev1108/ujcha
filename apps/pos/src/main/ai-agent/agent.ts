import axios from 'axios'
import type { AiMenuItem } from './types'

const MENU_TTL = 5 * 60 * 1000

let menuCache: AiMenuItem[] | null = null
let toppingCache: { id: string; name: string; price: number }[] = []
let menuCacheAt = 0

export async function fetchMenuAndToppings(
  apiBaseUrl: string,
  accessToken: string,
): Promise<{ menu: AiMenuItem[]; toppings: { id: string; name: string; price: number }[] }> {
  const menu = await fetchMenu(apiBaseUrl, accessToken)
  return { menu, toppings: toppingCache }
}

async function fetchMenu(apiBaseUrl: string, accessToken: string): Promise<AiMenuItem[]> {
  if (menuCache && Date.now() - menuCacheAt < MENU_TTL) return menuCache

  const headers = { Authorization: `Bearer ${accessToken}` }
  const [prodRes, topRes] = await Promise.all([
    axios.get<ApiProduct[]>(`${apiBaseUrl}/admin/products`, { headers }),
    axios.get<ApiTopping[]>(`${apiBaseUrl}/admin/toppings?activeOnly=true`, { headers }),
  ])

  toppingCache = topRes.data.map((t) => ({ id: t.id, name: t.name, price: Number(t.price) }))

  menuCache = prodRes.data.map((p) => ({
    id: p.id,
    name: p.name,
    category: typeof p.category === 'object' && p.category ? (p.category as { name: string }).name : 'Khác',
    price: Number(p.price),
    imageUrl: Array.isArray(p.imageUrls) ? (p.imageUrls[0] ?? null) : null,
    options: Array.isArray(p.optionGroups)
      ? (p.optionGroups as ApiOptionGroup[]).map((g) => ({
          name: g.name,
          values: g.values.map((v) =>
            typeof v === 'string'
              ? { label: v, priceDelta: 0 }
              : { label: String(v.label ?? ''), priceDelta: Number(v.priceDelta ?? 0) }
          ),
        }))
      : [],
    isAvailable: p.isAvailable,
    isSoldOut: p.isSoldOut,
  }))
  menuCacheAt = Date.now()
  return menuCache
}

export function invalidateMenuCache() {
  menuCache = null
  menuCacheAt = 0
}

interface ApiOptionValue {
  label?: string
  priceDelta?: number
}

interface ApiOptionGroup {
  name: string
  values: (string | ApiOptionValue)[]
}

interface ApiProduct {
  id: string
  name: string
  price: string
  category?: unknown
  imageUrls?: string[]
  optionGroups: ApiOptionGroup[]
  isAvailable: boolean
  isSoldOut: boolean
}

interface ApiTopping {
  id: string
  name: string
  price: string
}
