import { haversineMeters } from './distance';

const MAX_SPEED_KMH = 150;
const MIN_WINDOW_S = 1;

export type LocationPoint = { lat: number; lng: number; timestamp: number };

export function isLocationSuspicious(prev: LocationPoint, next: LocationPoint): boolean {
  const dtS = (next.timestamp - prev.timestamp) / 1000;
  if (dtS < MIN_WINDOW_S) return false;

  const dist = haversineMeters(prev.lat, prev.lng, next.lat, next.lng);
  const speedKmh = (dist / dtS) * 3.6;

  return speedKmh > MAX_SPEED_KMH;
}
