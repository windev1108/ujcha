import { Injectable, NotFoundException } from '@nestjs/common';
import type { Cart } from '@prisma/client';
import { normalizeInlineOptionGroups, normalizeInlineToppings } from '../../helper/utils';
import { PrismaService } from '../prisma/prisma.service';
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

/** Normalize a raw cart item from DB (expand product optionGroups + toppings JSON). */
function normalizeCartItem(item: any) {
  const rawToppings: { id: string; name: string; price: string | number }[] =
    Array.isArray(item.toppingsJson) ? item.toppingsJson : [];

  return {
    ...item,
    toppingsJson: undefined,
    // Return in the nested ApiCartTopping shape the client expects
    toppings: rawToppings.map((t) => ({
      toppingId: t.id,
      topping: { id: t.id, name: t.name, price: String(t.price), nameTranslation: (t as any).nameTranslation ?? {} },
    })),
    product: item.product
      ? {
          ...item.product,
          optionGroups: normalizeInlineOptionGroups(item.product.optionGroups),
          toppings: normalizeInlineToppings(item.product.toppings),
        }
      : item.product,
  };
}

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) { }

  private async getOrCreateCart(userId: string): Promise<Cart> {
    const existing = await this.prisma.cart.findUnique({ where: { userId } });
    if (existing) return existing;
    return this.prisma.cart.create({ data: { userId } });
  }

  async addToCart(userId: string, dto: AddToCartDto) {
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

    return normalizeCartItem(item);
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
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

    return normalizeCartItem(updated);
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
      items: cart.items.map(normalizeCartItem),
    };
  }
}
