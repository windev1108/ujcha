import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const AUTH_KEY = 'shipper_auth';

export type ShipperProfile = {
  id: string;
  name: string;
  phone: string | null;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  shipper: ShipperProfile | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string, shipper: ShipperProfile) => Promise<void>;
  updateShipper: (updates: Partial<ShipperProfile>) => void;
  clearAuth: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  shipper: null,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(AUTH_KEY);
      if (raw) {
        const { accessToken, refreshToken, shipper } = JSON.parse(raw) as {
          accessToken: string;
          refreshToken: string;
          shipper: ShipperProfile;
        };
        set({ accessToken, refreshToken, shipper, hydrated: true });
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },

  setTokens: async (accessToken, refreshToken, shipper) => {
    set({ accessToken, refreshToken, shipper });
    try {
      await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify({ accessToken, refreshToken, shipper }));
    } catch {
      // SecureStore unavailable on web — in-memory state already set above
    }
  },

  updateShipper: (updates) =>
    set((state) => {
      const updated = { ...state.shipper, ...updates } as ShipperProfile;
      const { accessToken, refreshToken } = state;
      void SecureStore.setItemAsync(AUTH_KEY, JSON.stringify({ accessToken, refreshToken, shipper: updated })).catch(() => {});
      return { shipper: updated };
    }),

  clearAuth: async () => {
    set({ accessToken: null, refreshToken: null, shipper: null });
    try {
      await SecureStore.deleteItemAsync(AUTH_KEY);
    } catch {
      // SecureStore unavailable on web
    }
  },
}));
