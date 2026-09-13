import { loadLocal, saveLocal } from '../renderer/src/lib/local-storage'

const CACHE_KEY = 'grabNetCache'
const RATE_KEY = 'grabLearnedCommissionRate'

function toFiniteNumber(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export function getCachedNet(displayID: string): number | null {
  const raw = loadLocal<Record<string, number>>(CACHE_KEY, {})
  return toFiniteNumber(raw?.[displayID])
}

export function learnFromDetail(displayID: string, net: number, commissionRate: number) {
  if (!Number.isFinite(net) || !Number.isFinite(commissionRate)) return // không lưu rác
  const all = loadLocal<Record<string, number>>(CACHE_KEY, {})
  all[displayID] = net
  saveLocal(CACHE_KEY, all)
  const prev = toFiniteNumber(loadLocal<number | null>(RATE_KEY, null))
  saveLocal(RATE_KEY, prev ? prev * 0.7 + commissionRate * 0.3 : commissionRate)
}

export function getLearnedCommissionRate(fallback: number): number {
  return toFiniteNumber(loadLocal<number | null>(RATE_KEY, null)) ?? fallback
}