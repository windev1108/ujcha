import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { AdminUser } from "@/services/auth/types";

function setAuthCookie(token: string) {
  document.cookie = `admin_access_token=${token}; path=/; SameSite=Strict; max-age=86400`;
}

function clearAuthCookie() {
  document.cookie = "admin_access_token=; path=/; max-age=0";
}

export type AuthState = {
  admin: AdminUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  setSession: (payload: {
    admin: AdminUser;
    accessToken: string;
    refreshToken: string;
  }) => void;
  setTokens: (payload: { accessToken: string; refreshToken: string }) => void;
  setAccessToken: (accessToken: string) => void;
  setHydrated: (v: boolean) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      admin: null,
      accessToken: null,
      refreshToken: null,
      hydrated: false,
      setSession: ({ admin, accessToken, refreshToken }) => {
        setAuthCookie(accessToken);
        set({ admin, accessToken, refreshToken });
      },
      setTokens: ({ accessToken, refreshToken }) => {
        setAuthCookie(accessToken);
        set({ accessToken, refreshToken });
      },
      setAccessToken: (accessToken) => {
        setAuthCookie(accessToken);
        set({ accessToken });
      },
      setHydrated: (hydrated) => set({ hydrated }),
      clearSession: () => {
        clearAuthCookie();
        set({ admin: null, accessToken: null, refreshToken: null });
      },
    }),
    {
      name: "kun-admin-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        admin: s.admin,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
      }),
    },
  ),
);
