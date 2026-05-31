export interface ApiCategory {
  id: string
  name: string
  nameTranslation?: Record<string, string>
  slug: string
  sortOrder: number
  thumbnail: string | null
  _count: { products: number }
}
