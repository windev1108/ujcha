import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('REDIS_URL');
    if (!url) {
      this.logger.warn('REDIS_URL not set — caching disabled, falling back to DB only.');
      return;
    }
    this.client = new Redis(url, { lazyConnect: true, enableOfflineQueue: false });
    this.client.on('error', (err) => this.logger.error('Redis error', err.message));
    this.client.connect().catch((err) => {
      this.logger.error('Redis connect failed', err.message);
      this.client = null;
    });
  }

  async onModuleDestroy() {
    await this.client?.quit().catch(() => {});
  }

  get isAvailable() {
    return this.client !== null && this.client.status === 'ready';
  }

  // ─── generic ──────────────────────────────────────────────────────────

  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable) return null;
    try {
      const raw = await this.client!.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.isAvailable) return;
    try {
      await this.client!.setex(key, ttlSeconds, JSON.stringify(value));
    } catch {
      // best-effort
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isAvailable) return;
    try {
      await this.client!.del(key);
    } catch {
      // best-effort
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    if (!this.isAvailable) return;
    try {
      const keys = await this.client!.keys(pattern);
      if (keys.length > 0) await this.client!.del(...keys);
    } catch {
      // best-effort
    }
  }

  // ─── rate-limit helpers ───────────────────────────────────────────────

  /** Atomic increment in a sliding window. Returns new count. */
  async incrementWindow(key: string, windowSeconds: number): Promise<number> {
    if (!this.isAvailable) return 0;
    try {
      const pipeline = this.client!.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, windowSeconds, 'NX');
      const results = await pipeline.exec();
      return (results?.[0]?.[1] as number) ?? 0;
    } catch {
      return 0;
    }
  }
}
