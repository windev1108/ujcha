import { create } from 'zustand'
import { fetchAdminRoomMessages, fetchOrderById, type ChatMessage } from '@/api'
import { useChatNotifyStore } from '@/store/chat-notify-store'

export type ChatKind = 'order' | 'group'

export interface DockConversation {
  key: string
  kind: ChatKind
  id: string                 // roomId (order.id hoặc group id)
  orderId: string | null     // dùng cho nút "Xem đơn"
  customerName: string
  avatar: string | null
  orderCode: string | null
  unread: number
  lastMessage: string
  lastAt: string
  lastMessageId: string | null
}

interface ReceiveInput {
  kind: ChatKind
  id: string
  orderId?: string | null
  message: ChatMessage
}

interface OpenInput {
  kind: ChatKind
  id: string
  orderId?: string | null
  customerName?: string
  avatar?: string | null
  orderCode?: string | null
}

interface State {
  conversations: Record<string, DockConversation>
  order: string[]            // thứ tự tạo bubble (cũ nhất ở dưới, mới dồn lên trên)
  openKey: string | null
  notify: (p: { kind: ChatKind; id: string }) => void
  openConversation: (p: OpenInput) => void
  toggle: (key: string) => void
  close: () => void
  dismiss: (key: string) => void
  reset: () => void
}

const keyOf = (kind: ChatKind, id: string) => `${kind}:${id}`

function previewOf(m: ChatMessage): string {
  if (m.type === 'sticker') return '[Nhãn dán]'
  if (m.type === 'image') return '[Hình ảnh]'
  return m.content
}

export const useChatDockStore = create<State>((set, get) => {
  // Lấy mã đơn để hiện trên title chat
  const hydrate = (key: string) => {
    const c = get().conversations[key]
    if (!c?.orderId || c.orderCode) return
    fetchOrderById(c.orderId)
      .then((o) => {
        const code = o.paymentCode ?? o.orderRef ?? o.id.slice(0, 8).toUpperCase()
        set((s) =>
          s.conversations[key]
            ? { conversations: { ...s.conversations, [key]: { ...s.conversations[key], orderCode: code } } }
            : s,
        )
      })
      .catch(() => { })
  }
  const stripPlatformTag = (s: string) => s.replace(/^\[[^\]]+\]\s*/, '').trim()

  // Payload socket không kèm nội dung → tự lấy tin cuối + đơn để điền thông tin bubble
  const refresh = async (key: string) => {
    const c = get().conversations[key]
    if (!c) return
    const patch: Partial<DockConversation> = {}

    try {
      const res = await fetchAdminRoomMessages(c.kind, c.id, { limit: 1 })
      const last = [...res.messages].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ).pop()
      if (last) {
        patch.lastMessage = previewOf(last)
        patch.lastAt = last.createdAt
        patch.lastMessageId = last.id
        if (last.senderType !== 'staff') {
          if (last.displayName) patch.customerName = last.displayName
          if (last.avatar) patch.avatar = last.avatar
        }
      }
    } catch { /* ignore */ }

    if (c.orderId && (!c.orderCode || c.customerName === 'Khách')) {
      try {
        const o = await fetchOrderById(c.orderId)
        patch.orderCode = o.paymentCode ?? o.orderRef ?? o.id.slice(0, 8).toUpperCase()
        if (!patch.customerName && c.customerName === 'Khách') {
          const n = stripPlatformTag(o.guestDeliveryName ?? o.user?.name ?? '')
          if (n) patch.customerName = n
        }
      } catch { /* ignore */ }
    }

    // Chỉ ghi đè thông tin hiển thị, KHÔNG đụng unread (user có thể đã mở chat trong lúc fetch)
    set((s) =>
      s.conversations[key]
        ? { conversations: { ...s.conversations, [key]: { ...s.conversations[key], ...patch, unread: s.conversations[key].unread } } }
        : s,
    )
  }
  return {
    conversations: {},
    order: [],
    openKey: null,

    notify: ({ kind, id }) => {
      const key = keyOf(kind, id)
      const { conversations, openKey } = get()
      // Chat đang mở → ChatPanel tự nhận tin qua useChatSocket, không cần bubble/unread
      if (openKey === key) return

      const prev = conversations[key]
      const next: DockConversation = {
        key, kind, id,
        orderId: kind === 'order' ? id : prev?.orderId ?? null,
        customerName: prev?.customerName ?? 'Khách',
        avatar: prev?.avatar ?? null,
        orderCode: prev?.orderCode ?? null,
        unread: (prev?.unread ?? 0) + 1,
        lastMessage: prev?.lastMessage ?? '',
        lastAt: new Date().toISOString(),
        lastMessageId: prev?.lastMessageId ?? null,
      }
      set((s) => ({
        conversations: { ...s.conversations, [key]: next },
        order: s.order.includes(key) ? s.order : [...s.order, key],
      }))
      void refresh(key)
    },

    openConversation: (p) => {
      const key = keyOf(p.kind, p.id)
      const prev = get().conversations[key]
      const next: DockConversation = {
        key, kind: p.kind, id: p.id,
        orderId: p.orderId ?? prev?.orderId ?? null,
        customerName: p.customerName || prev?.customerName || 'Khách',
        avatar: p.avatar ?? prev?.avatar ?? null,
        orderCode: p.orderCode ?? prev?.orderCode ?? null,
        unread: 0,
        lastMessage: prev?.lastMessage ?? '',
        lastAt: prev?.lastAt ?? new Date().toISOString(),
        lastMessageId: prev?.lastMessageId ?? null,
      }
      set((s) => ({
        conversations: { ...s.conversations, [key]: next },
        order: s.order.includes(key) ? s.order : [...s.order, key],
        openKey: key,
      }))
      if (next.orderId) useChatNotifyStore.getState().clearUnread(next.orderId)
      hydrate(key)
    },

    toggle: (key) => {
      const c = get().conversations[key]
      if (!c) return
      if (get().openKey === key) { set({ openKey: null }); return }
      set((s) => ({
        openKey: key,
        conversations: { ...s.conversations, [key]: { ...c, unread: 0 } },
      }))
      if (c.orderId) useChatNotifyStore.getState().clearUnread(c.orderId)
    },

    close: () => set({ openKey: null }),

    dismiss: (key) =>
      set((s) => {
        const { [key]: _removed, ...rest } = s.conversations
        return {
          conversations: rest,
          order: s.order.filter((k) => k !== key),
          openKey: s.openKey === key ? null : s.openKey,
        }
      }),

    reset: () => set({ conversations: {}, order: [], openKey: null }),
  }
})