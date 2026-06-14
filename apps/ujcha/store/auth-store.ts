import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { zustandAsyncStorage } from '@/lib/storage'
import type { AuthUser } from '@/types'

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  hydrated: boolean

  setSession: (user: AuthUser, accessToken: string, refreshToken: string) => void
  patchUser: (patch: Partial<AuthUser>) => void
  setAccessToken: (token: string) => void
  setHydrated: (v: boolean) => void
  clearSession: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      hydrated: false,

      setSession: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken }),

      patchUser: (patch) =>
        set((s) => ({ user: s.user ? { ...s.user, ...patch } : null })),

      setAccessToken: (token) => set({ accessToken: token }),

      setHydrated: (v) => set({ hydrated: v }),

      clearSession: () =>
        set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: 'ujcha-auth',
      storage: createJSONStorage(() => zustandAsyncStorage),
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      },
    },
  ),
)
