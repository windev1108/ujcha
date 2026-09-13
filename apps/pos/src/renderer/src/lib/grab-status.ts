// lib/grab-status.ts
import { GRAB_STATUS_LABEL } from './constants'

export type GrabOrderContext = 'preparing' | 'ready' | 'upcoming' | 'history'

export function grabOrderLabel(state: string, context: GrabOrderContext): string {
  const s = state?.toUpperCase() ?? ''
  if (context === 'preparing' && s === 'ORDER_IN_PREPARE') return 'Đang chuẩn bị'
  if (context === 'ready' && s === 'ORDER_IN_PREPARE') return 'Sẵn sàng'
  if (context === 'upcoming') return 'Đặt trước'
  const fallback: Record<string, string> = {
    ACCEPTED: 'Đã nhận', PLACED: 'Mới đặt', ORDER_EXECUTING: 'Đang giao', DRIVER_AT_STORE: 'Tài xế đến',
  }
  return fallback[s] ?? GRAB_STATUS_LABEL[s] ?? s
}