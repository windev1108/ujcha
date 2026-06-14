import { api } from '@/services/api'
import type { AuthTokensResponse, AuthUser } from '@/types'

export async function postSendOtp(phone: string): Promise<void> {
  await api.post('/auth/send-otp', { phone })
}

export async function postRegister(payload: {
  phone: string
  name: string
  password: string
  code: string
  deviceId: string
  refCode?: string
}): Promise<AuthTokensResponse> {
  const res = await api.post<AuthTokensResponse>('/auth/register', payload)
  return res.data
}

export async function postLogin(payload: {
  phone: string
  password: string
  deviceId: string
}): Promise<AuthTokensResponse> {
  const res = await api.post<AuthTokensResponse>('/auth/login', payload)
  return res.data
}

export async function postResetPassword(payload: {
  phone: string
  code: string
  newPassword: string
}): Promise<void> {
  await api.post('/auth/reset-password', payload)
}

export async function postGoogleAuth(payload: {
  idToken: string
  deviceId: string
  refCode?: string
}): Promise<AuthTokensResponse> {
  const res = await api.post<AuthTokensResponse>('/auth/google', payload)
  return res.data
}

export async function getMe(): Promise<AuthUser> {
  const res = await api.get<AuthUser>('/auth/me')
  return res.data
}
