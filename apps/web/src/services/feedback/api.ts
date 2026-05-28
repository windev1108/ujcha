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
