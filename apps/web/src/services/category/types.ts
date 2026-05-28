export interface ApiCategory {
  id: string
  name: string
  slug: string
  sortOrder: number
  thumbnail: string | null
  _count: { products: number }
}
