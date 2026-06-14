import { api } from '@/services/api'
import type { UserProfileData } from '@/types'

export async function fetchProfile(): Promise<UserProfileData> {
  const res = await api.get<UserProfileData>('/profile')
  return res.data
}

export async function updateProfile(payload: Partial<Pick<UserProfileData, 'name' | 'email' | 'emailMarketingEnabled'>>): Promise<UserProfileData> {
  const res = await api.patch<UserProfileData>('/profile', payload)
  return res.data
}
