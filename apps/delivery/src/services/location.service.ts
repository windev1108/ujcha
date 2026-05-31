import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { LOCATION_TASK_NAME, TRACKING } from '@/constants/api';
import { useTrackingStore } from '@/store/tracking.store';
import { isLocationSuspicious } from '@/utils/anti-cheat';
import { haversineMeters } from '@/utils/distance';
import { socketService } from './socket.service';
import { locationQueue } from './queue.service';

type TaskData = { locations: Location.LocationObject[] };

let lastSentLocation: { lat: number; lng: number; timestamp: number } | null = null;
let lastSentAt = 0;

// Foreground subscription used as fallback when background task is unavailable (Expo Go)
let foregroundSub: Location.LocationSubscription | null = null;

// Standby: shipper manually enabled GPS from settings (not tied to any specific order)
let standbyEnabled = false;

function shouldSend(lat: number, lng: number, speed: number, now: number): boolean {
  if (!lastSentLocation) return true;
  const dist = haversineMeters(lastSentLocation.lat, lastSentLocation.lng, lat, lng);
  const elapsed = now - lastSentAt;
  const speedMs = speed > 0 ? speed * (1 / 3.6) : 0;
  const isHighSpeed = speedMs * 3.6 > TRACKING.HIGH_SPEED_KMH;
  const minInterval = isHighSpeed ? TRACKING.HIGH_SPEED_INTERVAL_MS : TRACKING.TIME_THROTTLE_MS;
  return dist >= TRACKING.DISTANCE_FILTER_METERS && elapsed >= minInterval;
}

function sendLocationUpdate(lat: number, lng: number, speed: number | null, timestamp: number) {
  const { activeOrderIds } = useTrackingStore.getState();
  if (!activeOrderIds.length) return;

  if (lastSentLocation) {
    const suspicious = isLocationSuspicious(
      { lat: lastSentLocation.lat, lng: lastSentLocation.lng, timestamp: lastSentLocation.timestamp },
      { lat, lng, timestamp },
    );
    if (suspicious) return;
  }

  if (!shouldSend(lat, lng, speed ?? 0, timestamp)) return;

  useTrackingStore.getState().setLastLocation({ lat, lng, timestamp });

  for (const orderId of activeOrderIds) {
    const payload = { orderId, lat, lng, timestamp, speed: speed ?? undefined };
    if (socketService.isConnected) {
      socketService.sendLocation(payload);
    } else {
      void locationQueue.enqueue(payload);
    }
  }

  lastSentLocation = { lat, lng, timestamp };
  lastSentAt = timestamp;
}

// Background task (works in production / dev builds)
TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }: TaskManager.TaskManagerTaskBody<TaskData>) => {
  if (error || !data?.locations?.length) return;
  for (const loc of data.locations) {
    const { latitude: lat, longitude: lng, speed } = loc.coords;
    sendLocationUpdate(lat, lng, speed, loc.timestamp);
  }
});

export const locationService = {
  async requestPermissions(): Promise<boolean> {
    try {
      const { status: fg } = await Location.requestForegroundPermissionsAsync();
      if (fg !== 'granted') return false;
      // Background permission is optional — Expo Go / restricted devices may not grant it
      try { await Location.requestBackgroundPermissionsAsync(); } catch { /* ignore */ }
      return true;
    } catch {
      return false;
    }
  },

  async startTracking(orderId: string): Promise<boolean> {
    const granted = await locationService.requestPermissions();
    if (!granted) return false;

    useTrackingStore.getState().startTracking(orderId);
    lastSentLocation = null;
    lastSentAt = 0;

    let backgroundStarted = false;
    try {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (!isRunning) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.High,
          distanceInterval: 0,
          timeInterval: TRACKING.TIME_THROTTLE_MS,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'UjCha Delivery',
            notificationBody: 'Đang theo dõi vị trí giao hàng...',
            notificationColor: '#1a3c34',
          },
        });
      }
      backgroundStarted = true;
    } catch {
      // Background location unavailable (Expo Go) — use foreground watchPosition
    }

    if (!backgroundStarted && !foregroundSub) {
      try {
        foregroundSub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: TRACKING.DISTANCE_FILTER_METERS,
            timeInterval: TRACKING.TIME_THROTTLE_MS,
          },
          (loc) => {
            const { latitude: lat, longitude: lng, speed } = loc.coords;
            sendLocationUpdate(lat, lng, speed, loc.timestamp);
          },
        );
      } catch {
        // watchPosition also failed — tracking state is set but no updates sent
      }
    }

    socketService.connect();
    await flushQueue(orderId);

    return true;
  },

  async stopTracking(orderId?: string): Promise<void> {
    useTrackingStore.getState().stopTracking(orderId);
    const { activeOrderIds } = useTrackingStore.getState();
    if (activeOrderIds.length > 0) return;

    // Stop background task
    try {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (isRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    } catch { /* no-op */ }

    // Stop foreground fallback
    foregroundSub?.remove();
    foregroundSub = null;
  },

  async getCurrentLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    } catch {
      return null;
    }
  },

  async getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status as 'granted' | 'denied' | 'undetermined';
    } catch {
      return 'undetermined';
    }
  },

  isForegroundTracking() {
    return foregroundSub !== null;
  },

  isGpsActive(): boolean {
    return standbyEnabled || useTrackingStore.getState().isTracking;
  },

  async enableGps(): Promise<boolean> {
    const granted = await locationService.requestPermissions();
    if (!granted) return false;
    standbyEnabled = true;
    if (!foregroundSub) {
      try {
        const bgRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (!bgRunning) {
          foregroundSub = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              distanceInterval: TRACKING.DISTANCE_FILTER_METERS,
              timeInterval: TRACKING.TIME_THROTTLE_MS,
            },
            (loc) => {
              const { latitude: lat, longitude: lng, speed } = loc.coords;
              sendLocationUpdate(lat, lng, speed, loc.timestamp);
            },
          );
        }
      } catch { /* GPS start failed — standbyEnabled still set */ }
    }
    return true;
  },

  async disableGps(): Promise<void> {
    standbyEnabled = false;
    const { activeOrderIds } = useTrackingStore.getState();
    if (activeOrderIds.length > 0) return;
    foregroundSub?.remove();
    foregroundSub = null;
    try {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (isRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    } catch { /* no-op */ }
  },
};

async function flushQueue(orderId: string) {
  const queued = await locationQueue.dequeueAll();
  if (!queued.length) return;
  for (const loc of queued) {
    socketService.sendLocation({ ...loc, orderId });
  }
}
