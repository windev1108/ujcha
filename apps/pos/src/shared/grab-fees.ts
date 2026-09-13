// lib/grab-fees.ts
export const GRAB_TAX_RATES = { vat: 0.03, pit: 0.015 } as const
export const DEFAULT_GRAB_COMMISSION_RATE = 0.19635 // học lại từ dữ liệu thật, xem grab-net-cache

export function parseVNDDisplay(display?: string | null): number {
  if (!display) return 0
  const n = parseInt(display.replace(/\./g, '').trim(), 10)
  return Number.isNaN(n) ? 0 : n
}

export function estimateGrabNetReceived(subtotal: number, commissionRate = DEFAULT_GRAB_COMMISSION_RATE, discount = 0) {
  const rate = Number.isFinite(commissionRate) ? commissionRate : DEFAULT_GRAB_COMMISSION_RATE
  const sub = Number.isFinite(subtotal) ? subtotal : 0
  const commission = Math.round(sub * rate)
  const vat = Math.round(sub * GRAB_TAX_RATES.vat)
  const pit = Math.round(sub * GRAB_TAX_RATES.pit)
  return sub - discount - commission - vat - pit
}