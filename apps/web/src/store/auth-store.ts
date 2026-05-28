import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { AuthUser } from "@/services/auth/types";

type Tokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  setSession: (payload: { user: AuthUser } & Tokens) => void;
  patchUser: (patch: Partial<AuthUser>) => void;
  setAccessToken: (accessToken: string) => void;
  setHydrated: (v: boolean) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      hydrated: false,
      setSession: ({ user, accessToken, refreshToken }) => {
        if (typeof document !== "undefined") {
          document.cookie = "kun-auth-state=1; path=/; SameSite=Lax";
        }
        set({ user, accessToken, refreshToken });
      },
      patchUser: (patch) =>
        set((s) => ({ user: s.user ? { ...s.user, ...patch } : s.user })),
      setAccessToken: (accessToken) => set({ accessToken }),
      setHydrated: (hydrated) => set({ hydrated }),
      clearSession: () => {
        if (typeof document !== "undefined") {
          document.cookie = "kun-auth-state=; path=/; max-age=0; SameSite=Lax";
        }
        set({ user: null, accessToken: null, refreshToken: null });
      },
    }),
    {
      name: "kun-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken && typeof document !== "undefined") {
          document.cookie = "kun-auth-state=1; path=/; SameSite=Lax";
        }
      },
    },
  ),
);
