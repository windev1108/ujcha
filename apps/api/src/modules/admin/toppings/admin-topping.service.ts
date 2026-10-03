// src/modules/admin/toppings/admin-topping.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { toppingNameKey } from '../../../helper/utils';
import { SetToppingOutOfStockDto } from '../../topping/dto/set-topping-out-of-stock.dto';
import { OOS_TOPPING_KEY } from '../../topping/topping.service';
import { SetToppingRecipeDto } from './dto/set-topping-recipe.dto';
import { findProductIdsByToppingNameKeys } from '../../../helper/topping-recipe';
import { PricingService } from '../../pricing/pricing.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminToppingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly pricingService: PricingService,
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

    const [oosRows, recipeRows] = await Promise.all([
      this.prisma.globalOutOfStockTopping.findMany(),
      this.prisma.globalToppingRecipeItem.findMany({
        include: { ingredient: { select: { name: true, unit: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const oosSet = new Set(oosRows.map((r) => r.nameKey));
    const recipeByKey = new Map<string, typeof recipeRows>();
    for (const r of recipeRows) {
      const arr = recipeByKey.get(r.nameKey) ?? [];
      arr.push(r);
      recipeByKey.set(r.nameKey, arr);
    }

    return [...seen.entries()]
      .map(([nameKey, name]) => ({
        nameKey,
        name,
        isOutOfStock: oosSet.has(nameKey),
        recipeItems: (recipeByKey.get(nameKey) ?? []).map((r) => ({
          ingredientId: r.ingredientId,
          ingredientName: r.ingredient.name,
          unit: r.ingredient.unit,
          quantity: Number(r.quantity),
        })),
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

  async setRecipe(dto: SetToppingRecipeDto) {
    const nameKey = toppingNameKey(dto.name);
    if (!nameKey) {
      throw new BadRequestException({
        message: 'Tên topping không hợp lệ.',
        code: 'TOPPING_NAME_INVALID',
      });
    }
    const items = dto.items.filter((i) => i.quantity > 0);
    const ids = items.map((i) => i.ingredientId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException({
        message:
          'Một nguyên liệu chỉ được xuất hiện 1 lần trong công thức topping.',
        code: 'DUPLICATE_TOPPING_RECIPE_INGREDIENT',
      });
    }
    if (ids.length) {
      const found = await this.prisma.ingredient.count({
        where: { id: { in: ids } },
      });
      if (found !== ids.length) {
        throw new BadRequestException({
          message: 'Có nguyên liệu không tồn tại.',
          code: 'INGREDIENT_NOT_FOUND',
        });
      }
    }

    await this.prisma.$transaction([
      this.prisma.globalToppingRecipeItem.deleteMany({ where: { nameKey } }),
      this.prisma.globalToppingRecipeItem.createMany({
        data: items.map((i) => ({
          nameKey,
          ingredientId: i.ingredientId,
          quantity: new Prisma.Decimal(i.quantity),
        })),
      }),
    ]);

    // Giá vốn của mọi sản phẩm có topping này đổi → tính lại
    const productIds = await findProductIdsByToppingNameKeys(this.prisma, [
      nameKey,
    ]);
    await this.pricingService.recomputeQuietly({ productIds });
    await this.redis.delByPattern('ujcha:products:list:*');
    return { nameKey, count: items.length };
  }
}
