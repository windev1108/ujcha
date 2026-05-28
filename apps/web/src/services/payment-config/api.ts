import { api } from '@/config/server'

export interface PublicPaymentConfig {
  bankCode: string
  accountNumber: string
  accountName: string
  isEnabled: boolean
}

export async function fetchPublicPaymentConfig(): Promise<PublicPaymentConfig> {
  const { data } = await api.get<PublicPaymentConfig>('/payment-config')
  return data
}
