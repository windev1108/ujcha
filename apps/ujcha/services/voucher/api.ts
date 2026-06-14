import { api } from '@/services/api'
import type { UserVoucher } from '@/types'

export async function fetchMyVouchers(): Promise<UserVoucher[]> {
  const res = await api.get<UserVoucher[]>('/vouchers/my')
  return res.data
}
