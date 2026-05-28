import { api } from '@/config/server'
import type { ApiTopping } from './types'

export async function fetchToppings(): Promise<ApiTopping[]> {
  const { data } = await api.get<ApiTopping[]>('/toppings')
  return data
}
