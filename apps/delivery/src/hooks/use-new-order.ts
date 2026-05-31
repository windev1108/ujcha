import { useEffect, useRef, useState } from 'react';
import { socketService, type NewDeliveryOrderPayload } from '@/services/socket.service';
import { useAuthStore } from '@/store/auth.store';

// Module-level ref so _layout.tsx can push available orders into the queue
// without prop-drilling. Works for single-instance RN apps.
let _globalEnqueue: ((orders: NewDeliveryOrderPayload[]) => void) | null = null;

export function enqueueAvailableOrders(orders: NewDeliveryOrderPayload[]) {
  _globalEnqueue?.(orders);
}

export function useNewOrder() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [incomingOrder, setIncomingOrder] = useState<NewDeliveryOrderPayload | null>(null);

  const queueRef = useRef<NewDeliveryOrderPayload[]>([]);
  const showingRef = useRef(false);
  const currentIdRef = useRef<string | null>(null);

  function showNext() {
    if (showingRef.current) return;
    const next = queueRef.current.shift();
    if (next) {
      showingRef.current = true;
      currentIdRef.current = next.orderId;
      setIncomingOrder(next);
    }
  }

  function dismiss() {
    showingRef.current = false;
    currentIdRef.current = null;
    setIncomingOrder(null);
    setTimeout(showNext, 300);
  }

  // Register the global enqueue so external code can push available orders in
  useEffect(() => {
    _globalEnqueue = (orders) => {
      let added = false;
      for (const o of orders) {
        const alreadyQueued = queueRef.current.some((q) => q.orderId === o.orderId);
        const isCurrent = currentIdRef.current === o.orderId;
        if (!alreadyQueued && !isCurrent) {
          queueRef.current.push(o);
          added = true;
        }
      }
      if (added) showNext();
    };
    return () => {
      _globalEnqueue = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!accessToken) return;

    const handler = (data: NewDeliveryOrderPayload) => {
      const alreadyQueued = queueRef.current.some((q) => q.orderId === data.orderId);
      const isCurrent = currentIdRef.current === data.orderId;
      if (!alreadyQueued && !isCurrent) {
        queueRef.current.push(data);
        showNext();
      }
    };

    const takenHandler = ({ orderId }: { orderId: string }) => {
      if (currentIdRef.current === orderId) dismiss();
      queueRef.current = queueRef.current.filter((o) => o.orderId !== orderId);
    };

    socketService.on<NewDeliveryOrderPayload>('order:new-delivery', handler);
    socketService.on<{ orderId: string }>('order:delivery-taken', takenHandler);

    return () => {
      socketService.off('order:new-delivery', handler as (...args: unknown[]) => void);
      socketService.off('order:delivery-taken', takenHandler as (...args: unknown[]) => void);
    };
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  return { incomingOrder, dismiss };
}
