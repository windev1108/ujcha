import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface ReverseGeocodeResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  class: string;
  type: string;
  place_rank: number;
  importance: number;
  addresstype: string;
  name: string;
  display_name: string;
  address: Address;
  boundingbox: string[];
}

export interface Address {
  house_number: string;
  road: string;
  suburb: string;
  city: string;
  'ISO3166-2-lvl4': string;
  postcode: string;
  country: string;
  country_code: string;
}

export interface LocationSearchParams {
  query: string;
  viewbox?: string;
  bounded?: boolean;
  countrycodes?: string;
  limit?: number;
  acceptLanguage?: string;
}

export interface LocationSearchResult { 
  place_id?: number; 
  licence?: string;
  osm_type?: string;
  osm_id?: number;
  lat: string;
  lon: string;
  display_name: string;
  addresstype?: string;
  address?: { house_number?: string; [key: string]: string | undefined };
  boundingbox?: string[];
  [key: string]: unknown;
}

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);

  private readonly CACHE_TTL = 60 * 60 * 24; // 24 hours
  private readonly SEARCH_CACHE_TTL = 60 * 60; // 1 hour

  constructor(private readonly redis: RedisService) { }

  async reverseGeocode(
    lat: number,
    lon: number,
    lang: string = 'vi',
  ): Promise<ReverseGeocodeResult> {
    const cacheKey = this.buildCacheKey(lat, lon);

    // 1. Redis cache
    const cached = await this.redis.get<ReverseGeocodeResult>(cacheKey);

    if (cached) {
      this.logger.debug(`Reverse geocode cache HIT: ${cacheKey}`);
      return cached;
    }

    this.logger.debug(`Reverse geocode cache MISS: ${cacheKey}`);

    // 2. Call Nominatim
    try {
      const url = new URL('https://nominatim.openstreetmap.org/reverse');

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

      const data = (await response.json()) as ReverseGeocodeResult;

      // 3. Save to Redis
      await this.redis.set(cacheKey, data, this.CACHE_TTL);

      return data;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      this.logger.error(
        `Reverse geocoding failed: ${error instanceof Error ? error.message : error}`,
      );

      throw new ServiceUnavailableException('Unable to resolve location');
    }
  }

  async search(params: LocationSearchParams): Promise<LocationSearchResult[]> {
    const {
      query,
      viewbox,
      bounded = true,
      countrycodes = 'vn',
      limit = 6,
      acceptLanguage = 'vi',
    } = params;
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return [];
    }
    const cacheKey = this.buildSearchCacheKey({
      query: normalizedQuery,
      viewbox,
      bounded,
      countrycodes,
      limit,
      acceptLanguage,
    });
    const cached = await this.redis.get<LocationSearchResult[]>(cacheKey);
    if (cached) {
      this.logger.debug(`Location search cache HIT: ${cacheKey}`);
      return cached;
    }
    this.logger.debug(`Location search cache MISS: ${cacheKey}`);
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', normalizedQuery);
      url.searchParams.set('format', 'json');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('accept-language', acceptLanguage);
      url.searchParams.set('countrycodes', countrycodes);
      if (viewbox) {
        url.searchParams.set('viewbox', viewbox);
        if (bounded) {
          url.searchParams.set('bounded', '1');
        }
      }
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Ujcha/1.0 (https://ujcha.vn)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        this.logger.warn(
          `Nominatim search returned ${response.status} for "${normalizedQuery}"`,
        );
        throw new ServiceUnavailableException(
          'Location search temporarily unavailable',
        );
      }
      const data = (await response.json()) as LocationSearchResult[];

      await this.redis.set(cacheKey, data, this.SEARCH_CACHE_TTL);
      return data;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(
        `Location search failed: ${error instanceof Error ? error.message : error}`,
      );
      throw new ServiceUnavailableException('Unable to search location');
    }
  }

  private buildCacheKey(lat: number, lon: number): string {
    const normalizedLat = lat.toFixed(4);
    const normalizedLon = lon.toFixed(4);

    return `location:reverse:${normalizedLat}:${normalizedLon}`;
  }

  private buildSearchCacheKey( params: LocationSearchParams, ): string {
     const query = params.query .trim() .toLowerCase() .replace(/\s+/g, ' ');
      const viewbox = params.viewbox ?? ''; 
      const bounded = params.bounded ? '1' : '0'; 
      const countrycodes = params.countrycodes ?? 'vn'; 
      const limit = params.limit ?? 6; 
      const language = params.acceptLanguage ?? 'vi';
       const rawKey = [ query, viewbox, bounded, countrycodes, limit, language, ].join('|');
        return `location:search:${encodeURIComponent(rawKey)}`; 
      }
}
