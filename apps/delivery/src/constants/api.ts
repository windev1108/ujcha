export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL ?? 'http://localhost:3001';
export const TRACKING_NAMESPACE = '/tracking';

export const LOCATION_TASK_NAME = 'ujcha-background-location';

export const TRACKING = {
  DISTANCE_FILTER_METERS: 10,
  TIME_THROTTLE_MS: 3_000,
  HIGH_SPEED_KMH: 30,
  HIGH_SPEED_INTERVAL_MS: 1_500,
} as const;
