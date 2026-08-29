import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface ReverseGeocodeResult {
  place_id: number
  licence: string
  osm_type: string
  osm_id: number
  lat: string
  lon: string
  class: string
  type: string
  place_rank: number
  importance: number
  addresstype: string
  name: string
  display_name: string
  address: Address
  boundingbox: string[]
}

export interface Address {
  house_number: string
  road: string
  suburb: string
  city: string
  'ISO3166-2-lvl4': string;
  postcode: string
  country: string
  country_code: string
}


@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);

  private readonly CACHE_TTL = 60 * 60 * 24; // 24 hours

  constructor(private readonly redis: RedisService) {}

  async reverseGeocode(
    lat: number,
    lon: number,
    lang: string = 'vi',
  ): Promise<ReverseGeocodeResult> {
    const cacheKey = this.buildCacheKey(lat, lon);

    // 1. Redis cache
    const cached =
      await this.redis.get<ReverseGeocodeResult>(cacheKey);

    if (cached) {
      this.logger.debug(`Reverse geocode cache HIT: ${cacheKey}`);
      return cached;
    }

    this.logger.debug(`Reverse geocode cache MISS: ${cacheKey}`);

    // 2. Call Nominatim
    try {
      const url = new URL(
        'https://nominatim.openstreetmap.org/reverse',
      );

      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lon));
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('accept-language', lang);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Ujcha/1.0 (https://ujcha.vn)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        this.logger.warn(
          `Nominatim returned ${response.status} for ${lat},${lon}`,
        );

        throw new ServiceUnavailableException(
          'Location service temporarily unavailable',
        );
      }

      const data =
        (await response.json()) as ReverseGeocodeResult;

      // 3. Save to Redis
      await this.redis.set(
        cacheKey,
        data,
        this.CACHE_TTL,
      );

      return data;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      this.logger.error(
        `Reverse geocoding failed: ${error instanceof Error ? error.message : error}`,
      );

      throw new ServiceUnavailableException(
        'Unable to resolve location',
      );
    }
  }

  private buildCacheKey(lat: number, lon: number): string {
    const normalizedLat = lat.toFixed(4);
    const normalizedLon = lon.toFixed(4);

    return `location:reverse:${normalizedLat}:${normalizedLon}`;
  }
}