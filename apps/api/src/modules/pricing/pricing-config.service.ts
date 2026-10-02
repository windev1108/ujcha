import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { UpdatePricingConfigDto } from './dto/update-pricing-config.dto';
import { PricingConfigLite } from '../../helper/pricing-calc';

const KEY = 'ujcha:pricing:config:v2';
const TTL = 30;
const DEFAULTS: PricingConfigLite = {
  isEnabled: false,
  defaultMarginPercent: null,
  roundingStep: 1000,
};

@Injectable()
export class PricingConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** fresh = true: bỏ qua cache (recompute dùng). */
  async get(fresh = false): Promise<PricingConfigLite> {
    if (!fresh) {
      const cached = await this.redis.get<PricingConfigLite>(KEY);
      if (cached) return cached;
    }
    const row = await this.prisma.pricingConfig.findUnique({
      where: { id: 'default' },
    });
    const cfg: PricingConfigLite = row
      ? {
          isEnabled: row.isEnabled,
          defaultMarginPercent:
            row.defaultMarginPercent == null
              ? null
              : row.defaultMarginPercent.toNumber(),
          roundingStep: row.roundingStep,
        }
      : DEFAULTS;
    await this.redis.set(KEY, cfg, TTL);
    return cfg;
  }

  async update(dto: UpdatePricingConfigDto): Promise<PricingConfigLite> {
    const margin =
      dto.defaultMarginPercent === undefined
        ? undefined // không đổi
        : dto.defaultMarginPercent === null
          ? null // xoá
          : new Prisma.Decimal(dto.defaultMarginPercent);

    await this.prisma.pricingConfig.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        isEnabled: dto.isEnabled ?? DEFAULTS.isEnabled,
        defaultMarginPercent: margin ?? null,
        roundingStep: dto.roundingStep ?? DEFAULTS.roundingStep,
      },
      update: {
        ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
        ...(margin !== undefined && { defaultMarginPercent: margin }),
        ...(dto.roundingStep !== undefined && {
          roundingStep: dto.roundingStep,
        }),
      },
    });
    await this.redis.del(KEY);
    // TODO(Bước E): gọi PricingService.recompute() toàn bộ sau khi đổi config.
    return this.get(true);
  }
}
