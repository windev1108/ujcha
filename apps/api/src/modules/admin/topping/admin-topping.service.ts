import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateToppingDto } from './dto/create-topping.dto';
import type { UpdateToppingDto } from './dto/update-topping.dto';

@Injectable()
export class AdminToppingService {
  constructor(private readonly prisma: PrismaService) {}

  list(activeOnly?: boolean) {
    return this.prisma.topping.findMany({
      where: activeOnly === true ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async getById(id: string) {
    const row = await this.prisma.topping.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({
        message: 'Không tìm thấy topping.',
        code: 'TOPPING_NOT_FOUND',
      });
    }
    return row;
  }

  create(dto: CreateToppingDto) {
    return this.prisma.topping.create({
      data: {
        name: dto.name.trim(),
        price: dto.price,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateToppingDto) {
    await this.getById(id);
    return this.prisma.topping.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(id: string) {
    await this.getById(id);
    await this.prisma.topping.delete({ where: { id } });
  }
}
