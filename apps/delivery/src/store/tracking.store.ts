import { create } from 'zustand';

export type LatLng = { lat: number; lng: number; timestamp: number };

type TrackingState = {
  isTracking: boolean;
  activeOrderIds: string[];
  lastLocation: LatLng | null;
  startTracking: (orderId: string) => void;
  stopTracking: (orderId?: string) => void;
  setLastLocation: (loc: LatLng) => void;
  isTrackingOrder: (orderId: string) => boolean;
};

export const useTrackingStore = create<TrackingState>((set, get) => ({
  isTracking: false,
  activeOrderIds: [],
  lastLocation: null,

  startTracking: (orderId) =>
    set((s) => {
      const ids = s.activeOrderIds.includes(orderId)
        ? s.activeOrderIds
        : [...s.activeOrderIds, orderId];
      return { isTracking: true, activeOrderIds: ids };
    }),

  stopTracking: (orderId) =>
    set((s) => {
      if (!orderId) return { isTracking: false, activeOrderIds: [], lastLocation: null };
      const ids = s.activeOrderIds.filter((id) => id !== orderId);
      return { isTracking: ids.length > 0, activeOrderIds: ids };
    }),

  setLastLocation: (lastLocation) => set({ lastLocation }),

  isTrackingOrder: (orderId) => get().activeOrderIds.includes(orderId),
}));
