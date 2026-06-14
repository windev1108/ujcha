import { useAuthStore } from '@/store/auth-store'

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)
  const hydrated = useAuthStore((s) => s.hydrated)

  return {
    user,
    accessToken,
    isLoggedIn: !!accessToken && !!user,
    isHydrated: hydrated,
  }
}
