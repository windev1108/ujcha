import { Injectable, NotFoundException } from '@nestjs/common';
import type { Cart } from '@prisma/client';
import {
  expandOptionGroupsWithMap,
  extractVariantGroupIds,
} from '../../helper/utils';
import { PrismaService } from '../prisma/prisma.service';
import type { AddToCartDto } from './dto/add-to-cart.dto';
import type { UpdateCartItemDto } from './dto/update-cart-item.dto';

const CART_ITEM_INCLUDE = {
  toppings: {
    include: {
      topping: {
        select: { id: true, name: true, price: true },
      },
    },
  },
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      imageUrls: true,
      discountPercent: true,
      optionGroups: true,
      category: { select: { name: true } },
    },
  },
} as const;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) { }

  private async expandCartItems<T extends { items: { product: { optionGroups: unknown } }[] }>(cart: T): Promise<T> {
    const allIds = new Set<string>();
    for (const item of cart.items) {
      for (const id of extractVariantGroupIds(item.product.optionGroups)) allIds.add(id);
    }
    const vgMap = new Map<string, { id: string; name: string; values: unknown }>();
    if (allIds.size > 0) {
      const vgs = await this.prisma.variantGroup.findMany({ where: { id: { in: [...allIds] } } });
      for (const vg of vgs) vgMap.set(vg.id, vg);
    }
    return {
      ...cart,
      items: cart.items.map((item) => ({
        ...item,
        product: {
          ...item.product,
          optionGroups: expandOptionGroupsWithMap(item.product.optionGroups, vgMap),
        },
      })),
    };
  }

  private async getOrCreateCart(userId: string): Promise<Cart> {
    const existing = await this.prisma.cart.findUnique({ where: { userId } });
    if (existing) return existing;
    return this.prisma.cart.create({ data: { userId } });
  }

  async addToCart(userId: string, dto: AddToCartDto) {
    const cart = await this.getOrCreateCart(userId);

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.cartItem.create({
        data: {
          cartId: cart.id,
          productId: dto.productId,
          quantity: dto.quantity,
          selectedOptions: dto.selectedOptions ?? {},
        },
      });

      if (dto.toppingIds?.length) {
        await tx.cartItemTopping.createMany({
          data: dto.toppingIds.map((toppingId) => ({
            cartItemId: item.id,
            toppingId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.cartItem.findUniqueOrThrow({
        where: { id: item.id },
        include: CART_ITEM_INCLUDE,
      });
    });
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cart: { userId } },
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

    return this.prisma.$transaction(async (tx) => {
      await tx.cartItem.update({
        where: { id: itemId },
        data: {
          quantity: dto.quantity,
          ...(dto.selectedOptions !== undefined && {
            selectedOptions: dto.selectedOptions,
          }),
        },
      });

      if (dto.toppingIds !== undefined) {
        await tx.cartItemTopping.deleteMany({ where: { cartItemId: itemId } });
        if (dto.toppingIds.length > 0) {
          await tx.cartItemTopping.createMany({
            data: dto.toppingIds.map((toppingId) => ({
              cartItemId: itemId,
              toppingId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.cartItem.findUniqueOrThrow({
        where: { id: itemId },
        include: CART_ITEM_INCLUDE,
      });
    });
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
    return this.expandCartItems(cart);
  }
}
