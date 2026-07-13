import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { MailService } from '../../mail/mail.service';
import type { UpdateShopSettingsDto } from './dto/update-shop-settings.dto';
import type { UpdateTtsConfigDto } from './dto/update-tts-config.dto';

const SETTINGS_ID = 'default';

@Injectable()
export class AdminShopSettingsService {
  private readonly logger = new Logger(AdminShopSettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mailService: MailService,
  ) { }

  async get() {
    return this.ensureRow();
  }

  async update(dto: UpdateShopSettingsDto) {
    const prev = await this.ensureRow();
    const v = Math.min(100, Math.max(0, Math.round(dto.globalDiscountPercent)));
    const result = await this.prisma.shopSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, globalDiscountPercent: v },
      update: { globalDiscountPercent: v },
    });
    void this.redis.del('ujcha:shop:globalDiscount');

    // Gửi email cho user subscribe khi admin bật/tăng global discount
    if (v > 0 && v !== prev.globalDiscountPercent) {
      void this.mailService
        .sendPromotionBlast({
          subject: `UjCha đang giảm giá ${v}% toàn bộ menu!`,
          title: `Ưu đãi đặc biệt: Giảm ${v}% toàn menu UjCha`,
          body: `Chúng tôi vừa áp dụng chương trình giảm giá ${v}% cho toàn bộ sản phẩm tại UjCha.\n\nĐây là thời điểm hoàn hảo để thưởng thức matcha ceremonial grade, cà phê và đồ uống thủ công yêu thích của bạn với mức giá cực ưu đãi!`,
          ctaText: 'Xem menu ngay',
          ctaUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ujcha.vn'}/menu`,
        })
        .catch((err) => this.logger.error('Email blast failed', err));
    }

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
