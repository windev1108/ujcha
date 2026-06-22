import { api } from '@/config/server'

export interface CreateFeedbackPayload {
  name?: string
  email?: string
  phone?: string
  content: string
  rating?: number
}

export async function submitFeedback(payload: CreateFeedbackPayload): Promise<void> {
  await api.post('/feedback', payload)
}

export interface PinnedFeedbackProduct {
  id: string
  name: string
  slug: string
  imageUrls: string[]
}

export interface PinnedFeedback {
  id: string
  name: string | null
  content: string
  rating: number | null
  externalId: string | null
  createdAt: string
  linkedProduct: PinnedFeedbackProduct | null
}

export async function fetchPinnedFeedbacks(): Promise<PinnedFeedback[]> {
  const { data } = await api.get<PinnedFeedback[]>('/feedback/pinned')
  return data
}
