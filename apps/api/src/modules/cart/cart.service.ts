import { Injectable, NotFoundException } from '@nestjs/common';
import type { Cart } from '@prisma/client';
import { computeFinalPrice, normalizeInlineOptionGroups, normalizeInlineToppings } from '../../helper/utils';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { AddToCartDto } from './dto/add-to-cart.dto';
import type { UpdateCartItemDto } from './dto/update-cart-item.dto';

const CART_ITEM_INCLUDE = {
  product: {
    select: {
      id: true,
      name: true,
      nameTranslation: true,
      slug: true,
      price: true,
      imageUrls: true,
      discountPercent: true,
      optionGroups: true,
      toppings: true,
      category: { select: { name: true, nameTranslation: true } },
    },
  },
} as const;

const GLOBAL_DISCOUNT_KEY = 'kun:shop:globalDiscount';
const GLOBAL_DISCOUNT_TTL = 60;

/** Build toppingsJson from product.toppings filtered by the selected IDs. */
function buildToppingsJson(
  productToppings: unknown,
  selectedIds: string[] | undefined,
): { id: string; name: string; price: number }[] {
  if (!selectedIds?.length) return [];
  const toppings = normalizeInlineToppings(productToppings);
  return toppings
    .filter((t) => t.isActive && selectedIds.includes(t.id))
    .map((t) => ({ id: t.id, name: t.name, price: t.price, nameTranslation: t.nameTranslation ?? {} }));
}

/** Normalize a raw cart item, merging global discount into finalPrice. */
function normalizeCartItem(item: any, globalDiscount: number) {
  const rawToppings: { id: string; name: string; price: string | number }[] =
    Array.isArray(item.toppingsJson) ? item.toppingsJson : [];

  const effectiveDiscount = item.product
    ? Math.min(100, (item.product.discountPercent ?? 0) + globalDiscount)
    : 0;

  return {
    ...item,
    toppingsJson: undefined,
    toppings: rawToppings.map((t) => ({
      toppingId: t.id,
      topping: { id: t.id, name: t.name, price: String(t.price), nameTranslation: (t as any).nameTranslation ?? {} },
    })),
    product: item.product
      ? {
          ...item.product,
          discountPercent: effectiveDiscount,
          optionGroups: normalizeInlineOptionGroups(item.product.optionGroups),
          toppings: normalizeInlineToppings(item.product.toppings),
          finalPrice: computeFinalPrice(item.product.price, effectiveDiscount),
        }
      : item.product,
  };
}

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) { }

  private async getGlobalDiscount(): Promise<number> {
    try {
      const cached = await this.redis.get<number>(GLOBAL_DISCOUNT_KEY);
      if (cached !== null) return cached;
      const settings = await this.prisma.shopSettings.findFirst();
      const val = settings?.globalDiscountPercent ?? 0;
      await this.redis.set(GLOBAL_DISCOUNT_KEY, val, GLOBAL_DISCOUNT_TTL);
      return val;
    } catch {
      return 0;
    }
  }

  private async getOrCreateCart(userId: string): Promise<Cart> {
    const existing = await this.prisma.cart.findUnique({ where: { userId } });
    if (existing) return existing;
    return this.prisma.cart.create({ data: { userId } });
  }

  async addToCart(userId: string, dto: AddToCartDto) {
    const globalDiscount = await this.getGlobalDiscount();
    const cart = await this.getOrCreateCart(userId);

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { toppings: true },
    });

    const toppingsJson = buildToppingsJson(product?.toppings, dto.toppingIds);

    const item = await this.prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: dto.productId,
        quantity: dto.quantity,
        selectedOptions: dto.selectedOptions ?? {},
        toppingsJson,
      },
      include: CART_ITEM_INCLUDE,
    });

    return normalizeCartItem(item, globalDiscount);
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const globalDiscount = await this.getGlobalDiscount();
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cart: { userId } },
      include: { product: { select: { toppings: true } } },
    });

    if (!item) {
      throw new NotFoundException({
        message: 'Không tìm thấy dòng trong giỏ.',
        code: 'CART_ITEM_NOT_FOUND',
      });
    }

    if (dto.quantity <= 0) {
      await this.prisma.cartItem.delete({ where: { id: itemId } });
      return null;
    }

    const toppingsJson =
      dto.toppingIds !== undefined
        ? buildToppingsJson(item.product?.toppings, dto.toppingIds)
        : undefined;

    const updated = await this.prisma.cartItem.update({
      where: { id: itemId },
      data: {
        quantity: dto.quantity,
        ...(dto.selectedOptions !== undefined && { selectedOptions: dto.selectedOptions }),
        ...(toppingsJson !== undefined && { toppingsJson }),
      },
      include: CART_ITEM_INCLUDE,
    });

    return normalizeCartItem(updated, globalDiscount);
  }

  async removeItem(userId: string, itemId: string): Promise<void> {
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cart: { userId } },
    });

    if (!item) {
      throw new NotFoundException({
        message: 'Không tìm thấy dòng trong giỏ.',
        code: 'CART_ITEM_NOT_FOUND',
      });
    }

    await this.prisma.cartItem.delete({ where: { id: itemId } });
  }

  async removeItems(userId: string, itemIds: string[]): Promise<void> {
    await this.prisma.cartItem.deleteMany({
      where: {
        id: { in: itemIds },
        cart: { userId },
      },
    });
  }

  async getCart(userId: string) {
    const globalDiscount = await this.getGlobalDiscount();
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
          include: CART_ITEM_INCLUDE,
        },
      },
    });

    if (!cart) return null;
    return {
      ...cart,
      items: cart.items.map((item) => normalizeCartItem(item, globalDiscount)),
    };
  }
}
