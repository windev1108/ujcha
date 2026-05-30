import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import type { LocationUpdateDto } from './dto/location-update.dto';

const LOCATION_TTL_S = 60;
const STATUS_TTL_S = 90;
const MAX_SPEED_KMH = 150;
const ANTI_CHEAT_MIN_SECONDS = 3;
const ANTI_CHEAT_MAX_METERS = 500;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type StoredLocation = {
  lat: number;
  lng: number;
  timestamp: number;
  speed?: number;
};

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(private readonly redis: RedisService) {}

  locationKey(shipperId: string) {
    return `shipper:${shipperId}:location`;
  }

  statusKey(shipperId: string) {
    return `shipper:${shipperId}:status`;
  }

  async updateLocation(shipperId: string, dto: LocationUpdateDto): Promise<StoredLocation> {
    const prev = await this.redis.get<StoredLocation>(this.locationKey(shipperId));

    if (prev) {
      const distMeters = haversineMeters(prev.lat, prev.lng, dto.lat, dto.lng);
      const dtSeconds = (dto.timestamp - prev.timestamp) / 1000;

      if (dtSeconds > 0 && dtSeconds < ANTI_CHEAT_MIN_SECONDS && distMeters > ANTI_CHEAT_MAX_METERS) {
        const speedKmh = (distMeters / dtSeconds) * 3.6;
        if (speedKmh > MAX_SPEED_KMH) {
          this.logger.warn(
            `Anti-cheat: shipper ${shipperId} impossible speed ${speedKmh.toFixed(0)} km/h — rejected`,
          );
          throw new ForbiddenException({ message: 'Vị trí không hợp lệ.', code: 'LOCATION_ANTI_CHEAT' });
        }
      }
    }

    const loc: StoredLocation = {
      lat: dto.lat,
      lng: dto.lng,
      timestamp: dto.timestamp,
      speed: dto.speed,
    };

    await Promise.all([
      this.redis.set(this.locationKey(shipperId), loc, LOCATION_TTL_S),
      this.redis.set(this.statusKey(shipperId), 'online', STATUS_TTL_S),
    ]);

    return loc;
  }

  getLocation(shipperId: string): Promise<StoredLocation | null> {
    return this.redis.get<StoredLocation>(this.locationKey(shipperId));
  }

  async getStatus(shipperId: string): Promise<'online' | 'offline'> {
    const s = await this.redis.get<string>(this.statusKey(shipperId));
    return s === 'online' ? 'online' : 'offline';
  }

  async markOffline(shipperId: string): Promise<void> {
    await this.redis.set(this.statusKey(shipperId), 'offline', STATUS_TTL_S);
  }
}
