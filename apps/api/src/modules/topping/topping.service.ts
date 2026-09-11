// topping/topping.service.ts (public, dùng chung với admin)
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export const OOS_TOPPING_KEY = 'ujcha:shop:oosToppingNameKeys';
export const OOS_TOPPING_TTL = 60;

@Injectable()
export class ToppingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getOutOfStockNameKeys(): Promise<string[]> {
    const cached = await this.redis.get<string[]>(OOS_TOPPING_KEY);
    if (cached !== null) return cached;
    const rows = await this.prisma.globalOutOfStockTopping.findMany({
      select: { nameKey: true },
    });
    const keys = rows.map((r) => r.nameKey);
    await this.redis.set(OOS_TOPPING_KEY, keys, OOS_TOPPING_TTL);
    return keys;
  }
}
