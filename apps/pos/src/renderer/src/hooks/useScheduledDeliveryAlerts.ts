import { useCallback, useEffect, useRef } from 'react'
import { fetchOrders } from '../api'
import type { AdminOrder, OrderStatus } from '../types/common'
import { DEFAULT_SCHEDULED_ALERT_CONFIG, type ScheduledAlertConfig } from '../types/common'
import { KEYS, loadLocal } from '../lib/local-storage'

const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready']

function thresholdMinutes(cfg: ScheduledAlertConfig, itemCount: number): number {
    if (cfg.mode === 'fixed') return cfg.fixedMinutes
    const v = cfg.dynamicBaseMinutes + itemCount * cfg.dynamicPerItemMinutes
    return Math.min(v, cfg.dynamicMaxMinutes)
}

export function useScheduledDeliveryAlerts(onAlert: (order: AdminOrder) => void, isLoggedIn: boolean) {
    const alertedIdsRef = useRef<Set<string>>(new Set())

    const check = useCallback(async () => {
        const cfg = loadLocal<ScheduledAlertConfig>(KEYS.scheduledAlert, DEFAULT_SCHEDULED_ALERT_CONFIG)
        if (!cfg.enabled) return
        try {
            const today = new Date().toISOString().slice(0, 10)
            const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
            const data = await fetchOrders(1, 200, today, tomorrow)
            const items = (data as { items: AdminOrder[] }).items ?? []
            const now = Date.now()
            for (const o of items) {
                if (!o.scheduledDeliveryTime) continue
                if (!ACTIVE_STATUSES.includes(o.status)) continue
                if (alertedIdsRef.current.has(o.id)) continue
                const scheduledAt = new Date(o.scheduledDeliveryTime).getTime()
                const itemCount = o.items.reduce((s, i) => s + i.quantity, 0)
                const windowMs = thresholdMinutes(cfg, itemCount) * 60_000
                const diff = scheduledAt - now
                // trong cửa sổ nhắc, và không nhắc đơn đã trễ quá 15' (tránh spam đơn cũ)
                if (diff <= windowMs && diff > -15 * 60_000) {
                    alertedIdsRef.current.add(o.id)
                    onAlert(o)
                }
            }
        } catch { /* ignore */ }
    }, [onAlert])

    useEffect(() => {
        if (!isLoggedIn) return
        void check()
        const t = setInterval(() => void check(), 30_000)
        return () => clearInterval(t)
    }, [isLoggedIn, check])
}