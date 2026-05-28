import { api } from '@/config/server'

export interface MyVoucherItem {
  id: string
  source: 'welcome' | 'referral' | 'admin_grant'
  usedAt: string | null
  createdAt: string
  voucher: {
    id: string
    code: string
    name: string
    discountType: 'percent' | 'fixed_amount'
    discountValue: string
    minOrderAmount: string
    maxDiscountAmount: string | null
    startsAt: string | null
    endsAt: string | null
    isActive: boolean
    isExpired: boolean
  }
}

export async function fetchMyVouchers(): Promise<MyVoucherItem[]> {
  const { data } = await api.get<MyVoucherItem[]>('/vouchers/my')
  return data
}
