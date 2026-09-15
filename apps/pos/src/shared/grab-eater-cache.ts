import { loadLocal, saveLocal } from '../renderer/src/lib/local-storage'

const CACHE_KEY = 'grabEaterCache' 
const TTL_MS = 7 * 24 * 60 * 60 * 1000 // cache 7 ngày
const MAX_ENTRIES = 1000

type CachedEaterInfo = {
  eaterName?: string
  mobileNumber?: string
  address?: string
  driverMobileNumber?: string
  cachedAt: number
}

type EaterCacheStore = Record<string, CachedEaterInfo>

function pruneExpired(store: EaterCacheStore): boolean {
  const now = Date.now()
  let changed = false
  for (const key of Object.keys(store)) {
    if (now - store[key].cachedAt > TTL_MS) { delete store[key]; changed = true }
  }
  const keys = Object.keys(store)
  if (keys.length > MAX_ENTRIES) {
    const sorted = keys.sort((a, b) => store[a].cachedAt - store[b].cachedAt)
    for (const k of sorted.slice(0, keys.length - MAX_ENTRIES)) delete store[k]
    changed = true
  }
  return changed
}

export function learnEaterInfo(
  displayID: string,
  info: { eaterName?: string | null; mobileNumber?: string | null; address?: string | null; driverMobileNumber?: string | null },
) {
  if (!displayID) return
  if (!info.eaterName && !info.mobileNumber && !info.address && !info.driverMobileNumber) return

  const store = loadLocal<EaterCacheStore>(CACHE_KEY, {})
  pruneExpired(store)

  const prev = store[displayID]
  store[displayID] = {
    eaterName: info.eaterName || prev?.eaterName,
    mobileNumber: info.mobileNumber || prev?.mobileNumber,
    address: info.address || prev?.address,
    driverMobileNumber: info.driverMobileNumber || prev?.driverMobileNumber,
    cachedAt: Date.now(),
  }
  saveLocal(CACHE_KEY, store)
}

export function getCachedEaterInfo(
  displayID: string,
): { eaterName?: string; mobileNumber?: string; address?: string; driverMobileNumber?: string } | null {
  if (!displayID) return null
  const store = loadLocal<EaterCacheStore>(CACHE_KEY, {})
  const entry = store[displayID]
  if (!entry) return null

  if (Date.now() - entry.cachedAt > TTL_MS) {
    delete store[displayID]
    saveLocal(CACHE_KEY, store)
    return null
  }
  return { eaterName: entry.eaterName, mobileNumber: entry.mobileNumber, address: entry.address, driverMobileNumber: entry.driverMobileNumber }
}

export function pruneEaterCacheNow() {
  const store = loadLocal<EaterCacheStore>(CACHE_KEY, {})
  if (pruneExpired(store)) saveLocal(CACHE_KEY, store)
}