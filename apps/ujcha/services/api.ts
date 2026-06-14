import axios from 'axios'
import Constants from 'expo-constants'
import { useAuthStore } from '@/store/auth-store'

const API_URL =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_API_URL ??
  'http://localhost:5000'

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Inject access token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Silent token refresh on 401
let refreshPromise: Promise<string> | null = null

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }
    original._retry = true

    const { refreshToken, setAccessToken, clearSession } = useAuthStore.getState()
    if (!refreshToken) {
      clearSession()
      return Promise.reject(error)
    }

    try {
      if (!refreshPromise) {
        refreshPromise = axios
          .post<{ accessToken: string }>(`${API_URL}/auth/refresh`, { refreshToken })
          .then((r) => r.data.accessToken)
          .finally(() => { refreshPromise = null })
      }
      const newToken = await refreshPromise
      setAccessToken(newToken)
      original.headers.Authorization = `Bearer ${newToken}`
      return api(original)
    } catch {
      clearSession()
      return Promise.reject(error)
    }
  },
)

export const API_URL_VALUE = API_URL
