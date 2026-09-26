// web/src/services/chat/api.ts
import { api } from '@/config/server'

export type ChatMessageType = 'text' | 'sticker' | 'image'

export interface ChatMessage {
  id: string
  senderType: 'customer' | 'guest' | 'staff'
  displayName: string
  avatar: string | null
  content: string
  type: ChatMessageType
  senderId: string
  createdAt: string
}

export interface FetchMessagesOpts {
  limit?: number
  beforeId?: string
}

export interface ChatMessagePage {
  messages: ChatMessage[]
  hasMore: boolean
}

export async function fetchOrderChatMessages(paymentCode: string, opts: FetchMessagesOpts = {}) {
  const { data } = await api.get<{ kind: 'order'; id: string } & ChatMessagePage>(
    `/chat/orders/${paymentCode}/messages`,
    { params: opts },
  )
  return data
}

export async function sendOrderChatMessage(
  paymentCode: string,
  content: string,
  type: ChatMessageType = 'text',
) {
  const { data } = await api.post<ChatMessage>(`/chat/orders/${paymentCode}/messages`, { content, type })
  return data
}

export async function fetchGroupChatMessages(token: string, sessionToken: string, opts: FetchMessagesOpts = {}) {
  const { data } = await api.get<{ kind: 'group'; id: string } & ChatMessagePage>(
    `/chat/group-orders/${token}/messages`,
    { params: { sessionToken, ...opts } },
  )
  return data
}

export async function sendGroupChatMessage(
  token: string,
  sessionToken: string,
  content: string,
  type: ChatMessageType = 'text',
) {
  const { data } = await api.post<ChatMessage>(`/chat/group-orders/${token}/messages`, {
    sessionToken,
    content,
    type,
  })
  return data
}

// Upload ảnh qua backend proxy (backend gọi tmpfiles.org hộ, tránh CORS từ trình duyệt).
export async function uploadChatImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post<{ url: string }>('/upload/tmp-file', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.url
}