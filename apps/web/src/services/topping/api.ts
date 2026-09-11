import { api } from '@/config/server'
import type { ApiTopping } from './types'

export async function fetchToppings(): Promise<ApiTopping[]> {
  const { data } = await api.get<ApiTopping[]>('/toppings')
  return data
}


export const fetchOutOfStockToppingNames = () =>
  api.get<{ names: string[] }>("/toppings/out-of-stock").then((r) => r.data.names);

export const toppingNameKey = (name: string) => name.trim().toLowerCase();