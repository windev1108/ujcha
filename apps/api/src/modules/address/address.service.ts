import { Injectable, NotFoundException } from '@nestjs/common';
import type { Address } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateAddressDto } from './dto/create-address.dto';
import type { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressService {
  constructor(private readonly prisma: PrismaService) { }

  async createAddress(userId: string, dto: CreateAddressDto): Promise<Address> {
    const existingCount = await this.prisma.address.count({ where: { userId } });
    const isFirst = existingCount === 0;
    const isDefault = isFirst ? true : Boolean(dto.isDefault);

    return this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }
      return tx.address.create({
        data: {
          userId,
          fullAddress: dto.fullAddress,
          lat: dto.lat,
          lng: dto.lng,
          note: dto.note ?? null,
          isDefault,
        },
      });
    });
  }

  async getUserAddresses(userId: string): Promise<Address[]> {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async updateAddress(
    userId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ): Promise<Address> {
    const addr = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!addr) {
      throw new NotFoundException({
        message: 'Không tìm thấy địa chỉ.',
        code: 'ADDRESS_NOT_FOUND',
      });
    }

    const setDefault = dto.isDefault === true && !addr.isDefault;

    return this.prisma.$transaction(async (tx) => {
      if (setDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return tx.address.update({
        where: { id: addressId },
        data: {
          ...(dto.fullAddress !== undefined && { fullAddress: dto.fullAddress }),
          ...(dto.lat !== undefined && { lat: dto.lat }),
          ...(dto.lng !== undefined && { lng: dto.lng }),
          ...(dto.note !== undefined && { note: dto.note ?? null }),
          ...(setDefault && { isDefault: true }),
        },
      });
    });
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<Address> {
    const addr = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!addr) {
      throw new NotFoundException({
        message: 'Không tìm thấy địa chỉ.',
        code: 'ADDRESS_NOT_FOUND',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
      return tx.address.update({
        where: { id: addressId },
        data: { isDefault: true },
      });
    });
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    const addr = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!addr) {
      throw new NotFoundException({
        message: 'Không tìm thấy địa chỉ.',
        code: 'ADDRESS_NOT_FOUND',
      });
    }

    const wasDefault = addr.isDefault;

    await this.prisma.address.delete({ where: { id: addressId } });

    if (wasDefault) {
      const next = await this.prisma.address.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });
      if (next) {
        await this.prisma.address.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }
  }
}
