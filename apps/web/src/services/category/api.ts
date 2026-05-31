import { api } from '@/config/server'
import type { ApiCategory } from './types'

export async function fetchCategories(locale?: string): Promise<ApiCategory[]> {
  const { data } = await api.get<ApiCategory[]>('/categories', {
    params: locale ? { locale } : undefined,
  })
  return data
}
