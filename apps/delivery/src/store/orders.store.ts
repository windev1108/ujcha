import { create } from 'zustand';

export type OrderAddress = {
  fullAddress: string;
  lat: number | null;
  lng: number | null;
  note: string | null;
};

export type OrderItem = {
  id: string;
  quantity: number;
  price: number;
  optionsJson: Record<string, string>;
  extrasJson: Array<{ name: string; price: number }>;
  note: string | null;
  product: { name: string; imageUrls: string[] };
};

export type Order = {
  id: string;
  status: string;
  paymentCode: string;
  paymentType: string;
  paymentStatus: string;
  finalAmount: number;
  shippingFee: number;
  address: OrderAddress | null;
  items: OrderItem[];
  createdAt: string;
  user?: { name: string; phone: string } | null;
  guestDeliveryName?: string | null;
  guestDeliveryPhone?: string | null;
};

type OrdersState = {
  orders: Order[];
  loading: boolean;
  error: string | null;
  setOrders: (orders: Order[]) => void;
  updateOrderStatus: (orderId: string, status: string) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
};

export const useOrdersStore = create<OrdersState>((set) => ({
  orders: [],
  loading: false,
  error: null,

  setOrders: (orders) => set({ orders }),
  updateOrderStatus: (orderId, status) =>
    set((s) => ({
      orders: s.orders.map((o) => (o.id === orderId ? { ...o, status } : o)),
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
