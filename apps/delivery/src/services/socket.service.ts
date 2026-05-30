import { io, type Socket } from 'socket.io-client';
import { SOCKET_URL, TRACKING_NAMESPACE } from '@/constants/api';
import { useAuthStore } from '@/store/auth.store';

export type NewDeliveryOrderPayload = {
  orderId: string;
  paymentCode: string;
  customerName: string;
  customerPhone: string;
  address: string;
  addressNote: string | null;
  lat: number | null;
  lng: number | null;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    imageUrl: string | null;
    optionsJson: Record<string, string>;
    extrasJson: Array<{ name: string; price: number }>;
    note: string | null;
  }>;
  totalAmount: number;
  shippingFee: number;
  paymentType: string;
};

type LocationPayload = {
  shipperId: string;
  orderId: string;
  lat: number;
  lng: number;
  timestamp: number;
  speed?: number;
};

class SocketService {
  private socket: Socket | null = null;
  private authenticated = false;
  private pendingEmits: Array<() => void> = [];
  // Handlers registered before connect() is called are queued here and applied when socket is created.
  // React runs child effects before parent effects, so useNewOrder's on() calls happen before
  // RootLayout's connect() call — without this queue those handlers would silently be lost.
  private pendingListeners: Array<{ event: string; handler: (...args: unknown[]) => void }> = [];

  connect() {
    if (this.socket) return; // Already exists (connected or reconnecting)

    this.socket = io(`${SOCKET_URL}${TRACKING_NAMESPACE}`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
      reconnectionAttempts: Infinity,
    });

    // Flush any handlers registered before the socket was created
    for (const { event, handler } of this.pendingListeners.splice(0)) {
      this.socket.on(event, handler);
    }

    this.socket.on('connect', () => {
      this.authenticated = false;
      const token = useAuthStore.getState().accessToken;
      if (token) this.authenticate(token);
    });

    this.socket.on('shipper:auth:ok', () => {
      this.authenticated = true;
      this.flushPending();
    });

    this.socket.on('shipper:auth:error', () => {
      this.authenticated = false;
    });

    this.socket.on('disconnect', () => {
      this.authenticated = false;
    });
  }

  private authenticate(token: string) {
    this.socket?.emit('shipper:auth', { token });
  }

  private flushPending() {
    const fns = this.pendingEmits.splice(0);
    for (const fn of fns) fn();
  }

  sendLocation(payload: LocationPayload) {
    if (!this.socket) return;

    const emit = () => this.socket?.emit('location:update', payload);

    if (this.authenticated) {
      emit();
    } else {
      this.pendingEmits.push(emit);
    }
  }

  watchOrder(orderId: string) {
    this.socket?.emit('order:watch', { orderId });
  }

  unwatchOrder(orderId: string) {
    this.socket?.emit('order:unwatch', { orderId });
  }

  on<T>(event: string, handler: (data: T) => void) {
    if (this.socket) {
      this.socket.on(event, handler as (...args: unknown[]) => void);
    } else {
      this.pendingListeners.push({ event, handler: handler as (...args: unknown[]) => void });
    }
  }

  off(event: string, handler?: (...args: unknown[]) => void) {
    if (this.socket) {
      if (handler) {
        this.socket.off(event, handler);
      } else {
        this.socket.off(event);
      }
    }
    // Also purge from pending queue
    if (handler) {
      this.pendingListeners = this.pendingListeners.filter(
        (pl) => !(pl.event === event && pl.handler === (handler as (...args: unknown[]) => void)),
      );
    } else {
      this.pendingListeners = this.pendingListeners.filter((pl) => pl.event !== event);
    }
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.authenticated = false;
    this.pendingEmits = [];
    // pendingListeners are kept so re-connect() can re-apply them after re-login
  }

  get isConnected() {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
