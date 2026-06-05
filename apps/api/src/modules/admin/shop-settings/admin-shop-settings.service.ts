import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import type { UpdateShopSettingsDto } from './dto/update-shop-settings.dto';
import type { UpdateTtsConfigDto } from './dto/update-tts-config.dto';

const SETTINGS_ID = 'default';

@Injectable()
export class AdminShopSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async get() {
    return this.ensureRow();
  }

  async update(dto: UpdateShopSettingsDto) {
    const v = Math.min(100, Math.max(0, Math.round(dto.globalDiscountPercent)));
    const result = await this.prisma.shopSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, globalDiscountPercent: v },
      update: { globalDiscountPercent: v },
    });
    void this.redis.del('kun:shop:globalDiscount');
    return result;
  }

  async getTtsConfig() {
    const row = await this.ensureRow();
    return {
      voice: row.ttsVoice,
      speed: row.ttsSpeed,
      tts_return_option: row.ttsReturnOption,
      without_filter: row.ttsWithoutFilter,
    };
  }

  async updateTtsConfig(dto: UpdateTtsConfigDto) {
    const row = await this.prisma.shopSettings.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        globalDiscountPercent: 0,
        ttsVoice: dto.voice ?? 'hcm-diemmy',
        ttsSpeed: dto.speed ?? 1.0,
        ttsReturnOption: dto.tts_return_option ?? 3,
        ttsWithoutFilter: dto.without_filter ?? false,
      },
      update: {
        ...(dto.voice !== undefined && { ttsVoice: dto.voice }),
        ...(dto.speed !== undefined && { ttsSpeed: dto.speed }),
        ...(dto.tts_return_option !== undefined && { ttsReturnOption: dto.tts_return_option }),
        ...(dto.without_filter !== undefined && { ttsWithoutFilter: dto.without_filter }),
      },
    });
    return {
      voice: row.ttsVoice,
      speed: row.ttsSpeed,
      tts_return_option: row.ttsReturnOption,
      without_filter: row.ttsWithoutFilter,
    };
  }

  private async ensureRow() {
    return this.prisma.shopSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, globalDiscountPercent: 0 },
      update: {},
    });
  }
}
