// admin/ingredients/admin-ingredient.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryTransactionType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateIngredientDto } from '../inventory/dto/create-ingredient.dto';
import { UpdateIngredientDto } from '../inventory/dto/update-ingredient.dto';
import { AdjustIngredientStockDto } from '../inventory/dto/adjust-ingredient-stock.dto';
import { PricingService } from '../../pricing/pricing.service';

@Injectable()
export class AdminIngredientService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
  ) {}

  list(q?: string) {
    return this.prisma.ingredient.findMany({
      where: q?.trim()
        ? { name: { contains: q.trim(), mode: 'insensitive' } }
        : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async getById(id: string) {
    const row = await this.prisma.ingredient.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({
        message: 'Không tìm thấy nguyên liệu.',
        code: 'INGREDIENT_NOT_FOUND',
      });
    }
    return row;
  }

  create(dto: CreateIngredientDto) {
    return this.prisma.ingredient.create({
      data: {
        name: dto.name.trim(),
        unit: dto.unit.trim(),
        stockQty: new Prisma.Decimal(dto.stockQty ?? 0),
        lowStockThreshold:
          dto.lowStockThreshold != null
            ? new Prisma.Decimal(dto.lowStockThreshold)
            : null,
        note: dto.note?.trim() || null,
        ...(dto.costPerUnit != null && {
          costPerUnit: new Prisma.Decimal(dto.costPerUnit),
          costUpdatedAt: new Date(),
        }),
      },
    });
  }

  async update(id: string, dto: UpdateIngredientDto) {
    const existing = await this.getById(id);

    const unitChanging =
      dto.unit !== undefined && dto.unit.trim() !== existing.unit;
    if (
      unitChanging &&
      existing.costPerUnit != null &&
      dto.costPerUnit === undefined
    ) {
      throw new BadRequestException({
        message: 'Đổi đơn vị tính cần nhập lại giá vốn theo đơn vị mới.',
        code: 'INGREDIENT_UNIT_CHANGE_REQUIRES_COST',
      });
    }

    const nextCost =
      dto.costPerUnit === undefined
        ? undefined
        : dto.costPerUnit === null
          ? null
          : new Prisma.Decimal(dto.costPerUnit);
    const costChanged =
      nextCost !== undefined &&
      (nextCost === null
        ? existing.costPerUnit !== null
        : !existing.costPerUnit || !existing.costPerUnit.equals(nextCost));

    const updated = await this.prisma.ingredient.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.unit !== undefined && { unit: dto.unit.trim() }),
        ...(dto.lowStockThreshold !== undefined && {
          lowStockThreshold:
            dto.lowStockThreshold != null
              ? new Prisma.Decimal(dto.lowStockThreshold)
              : null,
        }),
        ...(dto.note !== undefined && { note: dto.note?.trim() || null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(nextCost !== undefined && { costPerUnit: nextCost }),
        ...(costChanged && { costUpdatedAt: new Date() }),
      },
    });
    if (costChanged) {
      const rows = await this.prisma.productRecipeItem.findMany({
        where: { ingredientId: id },
        select: { productId: true },
        distinct: ['productId'],
      });
      await this.pricingService.recomputeQuietly({
        productIds: rows.map((r) => r.productId),
      });
    }
    return updated;
  }

  async adjustStock(id: string, dto: AdjustIngredientStockDto) {
    const ingredient = await this.getById(id);
    return this.prisma.$transaction(async (tx) => {
      const resultQty = ingredient.stockQty.add(
        new Prisma.Decimal(dto.changeQty),
      );
      const updated = await tx.ingredient.update({
        where: { id },
        data: { stockQty: resultQty },
      });
      await tx.inventoryTransaction.create({
        data: {
          ingredientId: id,
          type:
            dto.changeQty >= 0
              ? InventoryTransactionType.restock
              : InventoryTransactionType.manual_adjust,
          changeQty: new Prisma.Decimal(dto.changeQty),
          resultQty,
          note: dto.note?.trim() || null,
        },
      });
      return updated;
    });
  }

  async remove(id: string) {
    await this.getById(id);
    try {
      await this.prisma.ingredient.delete({ where: { id } });
    } catch (e: any) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new BadRequestException({
          message:
            'Không xóa được nguyên liệu đang dùng trong công thức sản phẩm.',
          code: 'INGREDIENT_REFERENCED',
        });
      }
      throw e;
    }
  }

  history(id: string) {
    return this.prisma.inventoryTransaction.findMany({
      where: { ingredientId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
