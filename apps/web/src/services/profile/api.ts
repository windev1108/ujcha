import { api } from '@/config/server'

export interface UserProfileData {
  id: string
  name: string
  email: string | null
  phone: string | null
  avatar: string | null
  referralCode: string
  pointBalance: number
  emailMarketingEnabled: boolean
  lastAvatarUploadAt: string | null
}

export interface UpdateProfilePayload {
  name?: string
  email?: string | null
  emailMarketingEnabled?: boolean
}

export async function fetchProfile(): Promise<UserProfileData> {
  const { data } = await api.get<UserProfileData>('/profile')
  return data
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<UserProfileData> {
  const { data } = await api.patch<UserProfileData>('/profile', payload)
  return data
}

export async function uploadAvatar(imageBase64: string): Promise<UserProfileData> {
  const { data } = await api.post<UserProfileData>('/profile/avatar', { image: imageBase64 })
  return data
}
