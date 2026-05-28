import { api } from '@/config/server'
import type { ApiCategory } from './types'

export async function fetchCategories(): Promise<ApiCategory[]> {
  const { data } = await api.get<ApiCategory[]>('/categories')
  return data
}
