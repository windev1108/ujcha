// store/chat-notify-store.ts
import { create } from 'zustand'

interface ChatNotifyState {
    unreadOrderIds: Set<string>
    markUnread: (orderId: string) => void
    clearUnread: (orderId: string) => void
}

export const useChatNotifyStore = create<ChatNotifyState>((set) => ({
    unreadOrderIds: new Set(),
    markUnread: (orderId) => set((s) => {
        const next = new Set(s.unreadOrderIds); next.add(orderId); return { unreadOrderIds: next }
    }),
    clearUnread: (orderId) => set((s) => {
        if (!s.unreadOrderIds.has(orderId)) return s
        const next = new Set(s.unreadOrderIds); next.delete(orderId); return { unreadOrderIds: next }
    }),
}))