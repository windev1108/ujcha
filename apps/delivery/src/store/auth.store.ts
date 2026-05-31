import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  ACCESS_TOKEN: 'shipper_access_token',
  REFRESH_TOKEN: 'shipper_refresh_token',
  SHIPPER: 'shipper_profile',
} as const;

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
      const [accessToken, refreshToken, shipperJson] = await Promise.all([
        SecureStore.getItemAsync(KEYS.ACCESS_TOKEN),
        SecureStore.getItemAsync(KEYS.REFRESH_TOKEN),
        SecureStore.getItemAsync(KEYS.SHIPPER),
      ]);
      set({
        accessToken,
        refreshToken,
        shipper: shipperJson ? (JSON.parse(shipperJson) as ShipperProfile) : null,
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },

  setTokens: async (accessToken, refreshToken, shipper) => {
    set({ accessToken, refreshToken, shipper });
    try {
      await Promise.all([
        SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken),
        SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken),
        SecureStore.setItemAsync(KEYS.SHIPPER, JSON.stringify(shipper)),
      ]);
    } catch {
      // SecureStore unavailable on web — in-memory state already set above
    }
  },

  updateShipper: (updates) =>
    set((state) => {
      const updated = { ...state.shipper, ...updates } as ShipperProfile;
      void SecureStore.setItemAsync(KEYS.SHIPPER, JSON.stringify(updated)).catch(() => {});
      return { shipper: updated };
    }),

  clearAuth: async () => {
    set({ accessToken: null, refreshToken: null, shipper: null });
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
        SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN),
        SecureStore.deleteItemAsync(KEYS.SHIPPER),
      ]);
    } catch {
      // SecureStore unavailable on web
    }
  },
}));
