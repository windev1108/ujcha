// src/modules/admin/toppings/admin-topping.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { toppingNameKey } from '../../../helper/utils';
import { SetToppingOutOfStockDto } from '../../topping/dto/set-topping-out-of-stock.dto';
import { OOS_TOPPING_KEY } from '../../topping/topping.service';

@Injectable()
export class AdminToppingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Gom mọi tên topping (không trùng lặp, không phân biệt hoa/thường) đang tồn tại
   * trong Product.toppings (JSON) của toàn bộ sản phẩm, kèm trạng thái hết hàng global.
   */
  async listDistinctToppings() {
    const products = await this.prisma.product.findMany({
      select: { toppings: true },
    });

    const seen = new Map<string, string>(); // nameKey -> tên hiển thị (giữ bản gõ đầu tiên gặp)
    for (const p of products) {
      const arr = Array.isArray(p.toppings) ? (p.toppings as any[]) : [];
      for (const t of arr) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const name = String(t?.name ?? '').trim();
        if (!name) continue;
        const key = toppingNameKey(name);
        if (!seen.has(key)) seen.set(key, name);
      }
    }

    const oosRows = await this.prisma.globalOutOfStockTopping.findMany();
    const oosSet = new Set(oosRows.map((r) => r.nameKey));

    return [...seen.entries()]
      .map(([nameKey, name]) => ({
        nameKey,
        name,
        isOutOfStock: oosSet.has(nameKey),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }

  async setOutOfStock(dto: SetToppingOutOfStockDto) {
    const nameKey = toppingNameKey(dto.name);
    if (!nameKey) {
      throw new BadRequestException({
        message: 'Tên topping không hợp lệ.',
        code: 'TOPPING_NAME_INVALID',
      });
    }
    if (dto.isOutOfStock) {
      await this.prisma.globalOutOfStockTopping.upsert({
        where: { nameKey },
        create: { nameKey, name: dto.name.trim() },
        update: {},
      });
    } else {
      await this.prisma.globalOutOfStockTopping.deleteMany({
        where: { nameKey },
      });
    }
    await this.redis.del(OOS_TOPPING_KEY);
    return { nameKey, isOutOfStock: dto.isOutOfStock };
  }
}
