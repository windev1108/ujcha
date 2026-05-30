import { useCallback, useEffect } from 'react';
import { useTrackingStore } from '@/store/tracking.store';
import { locationService } from '@/services/location.service';
import { socketService } from '@/services/socket.service';
import { shipperApi } from '@/services/api.service';

export function useTracking(orderId: string) {
  const { isTracking, lastLocation, activeOrderIds, isTrackingOrder } = useTrackingStore();
  const isTrackingThis = isTrackingOrder(orderId);

  useEffect(() => {
    return () => {
      socketService.unwatchOrder(orderId);
    };
  }, [orderId]);

  const start = useCallback(async (): Promise<boolean> => {
    return locationService.startTracking(orderId);
  }, [orderId]);

  const stop = useCallback(async () => {
    await locationService.stopTracking(orderId);
  }, [orderId]);

  const complete = useCallback(async () => {
    await shipperApi.completeDelivery(orderId);
    await locationService.stopTracking(orderId);
  }, [orderId]);

  return {
    isTracking: isTrackingThis,
    isAnyTracking: isTracking,
    activeOrderIds,
    lastLocation,
    start,
    stop,
    complete,
  };
}
