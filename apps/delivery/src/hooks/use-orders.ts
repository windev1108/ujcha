import { useCallback } from 'react';
import { useOrdersStore } from '@/store/orders.store';
import { shipperApi } from '@/services/api.service';

export function useOrders() {
  const { orders, loading, error, setOrders, updateOrderStatus, setLoading, setError } = useOrdersStore();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await shipperApi.getOrders();
      setOrders(data as typeof orders);
    } catch {
      setError('Không thể tải danh sách đơn hàng.');
    } finally {
      setLoading(false);
    }
  }, [setOrders, setLoading, setError]);

  const markPickedUp = useCallback(async (orderId: string) => {
    await shipperApi.markPickedUp(orderId);
    updateOrderStatus(orderId, 'delivering');
  }, [updateOrderStatus]);

  const markArrived = useCallback(async (orderId: string) => {
    await shipperApi.markArrived(orderId);
    updateOrderStatus(orderId, 'arrived');
  }, [updateOrderStatus]);

  const completeDelivery = useCallback(async (orderId: string) => {
    await shipperApi.completeDelivery(orderId);
    updateOrderStatus(orderId, 'completed');
  }, [updateOrderStatus]);

  return { orders, loading, error, fetchOrders, markPickedUp, markArrived, completeDelivery };
}
