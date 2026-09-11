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

@Injectable()
export class AdminIngredientService {
  constructor(private readonly prisma: PrismaService) {}

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
      },
    });
  }

  async update(id: string, dto: UpdateIngredientDto) {
    await this.getById(id);
    return this.prisma.ingredient.update({
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
      },
    });
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
