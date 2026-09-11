import { Injectable, Logger } from '@nestjs/common';
import { InventoryTransactionType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);
  constructor(private readonly prisma: PrismaService) {}

  async deductForOrder(orderId: string) {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, inventoryDeductedAt: true },
      });
      if (!order || order.inventoryDeductedAt) return;

      const items = await tx.orderItem.findMany({
        where: { orderId },
        select: {
          productId: true,
          quantity: true,
          optionsJson: true,
          extrasJson: true,
        },
      });

      const productIds = [...new Set(items.map((i) => i.productId))];
      const [recipeRows, toppingRecipeRows] = productIds.length
        ? await Promise.all([
            tx.productRecipeItem.findMany({
              where: { productId: { in: productIds } },
            }),
            tx.productToppingRecipeItem.findMany({
              where: { productId: { in: productIds } },
            }),
          ])
        : [[], []];

      const needByIngredient = new Map<string, Prisma.Decimal>();
      const addNeed = (ingredientId: string, qty: Prisma.Decimal) =>
        needByIngredient.set(
          ingredientId,
          (needByIngredient.get(ingredientId) ?? new Prisma.Decimal(0)).add(
            qty,
          ),
        );

      for (const item of items) {
        const selectedOptions =
          (item.optionsJson as Record<string, string> | null) ?? {};
        const extras =
          (item.extrasJson as { toppingId?: string }[] | null) ?? [];

        // Nguyên liệu chung + nguyên liệu theo size đã chọn
        for (const r of recipeRows.filter(
          (r) => r.productId === item.productId,
        )) {
          const applies =
            r.optionGroupName == null ||
            selectedOptions[r.optionGroupName] === r.optionValueLabel;
          if (!applies) continue;
          addNeed(r.ingredientId, r.quantity.mul(item.quantity));
        }

        // Nguyên liệu từ topping đã chọn
        for (const extra of extras) {
          if (!extra.toppingId) continue;
          for (const tr of toppingRecipeRows.filter(
            (tr) =>
              tr.productId === item.productId &&
              tr.toppingId === extra.toppingId,
          )) {
            addNeed(tr.ingredientId, tr.quantity.mul(item.quantity));
          }
        }
      }

      for (const [ingredientId, need] of needByIngredient) {
        const ingredient = await tx.ingredient.findUnique({
          where: { id: ingredientId },
        });
        if (!ingredient) continue;
        const resultQty = ingredient.stockQty.sub(need);
        await tx.ingredient.update({
          where: { id: ingredientId },
          data: { stockQty: resultQty },
        });
        await tx.inventoryTransaction.create({
          data: {
            ingredientId,
            type: InventoryTransactionType.order_deduct,
            changeQty: need.neg(),
            resultQty,
            orderId,
          },
        });
        if (resultQty.lessThan(0)) {
          this.logger.warn(
            `Nguyên liệu "${ingredient.name}" âm kho sau đơn ${orderId}: ${resultQty}`,
          );
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data: { inventoryDeductedAt: new Date() },
      });
    });
  }
}
