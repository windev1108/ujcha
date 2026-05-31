import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateAdminDto } from './dto/create-admin.dto';
import type { UpdateAdminDto } from './dto/update-admin.dto';
import type { AdminManagementListQueryDto } from './dto/admin-management-list-query.dto';

const adminSelect = {
  id: true,
  email: true,
  role: true,
  isActive: true,
  name: true,
  phone: true,
  address: true,
  createdAt: true,
} as const;

@Injectable()
export class AdminManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminManagementListQueryDto) {
    const { q, role, page = 1, pageSize = 10 } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AdminWhereInput = {};
    if (q?.trim()) {
      where.email = { contains: q.trim(), mode: 'insensitive' };
    }
    if (role) {
      where.role = role;
    }

    const [items, total] = await Promise.all([
      this.prisma.admin.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: adminSelect,
      }),
      this.prisma.admin.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getById(id: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id },
      select: adminSelect,
    });
    if (!admin) throw new NotFoundException('Admin không tìm thấy.');
    return admin;
  }

  async create(dto: CreateAdminDto) {
    const existing = await this.prisma.admin.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (existing) throw new ConflictException('Email đã tồn tại.');
    return this.prisma.admin.create({
      data: {
        email: dto.email.trim().toLowerCase(),
        role: dto.role,
        name: dto.name?.trim() || null,
        phone: dto.phone?.trim() || null,
        address: dto.address?.trim() || null,
      },
      select: adminSelect,
    });
  }

  async update(id: string, dto: UpdateAdminDto, currentAdminId: string) {
    await this.getById(id);
    if (id === currentAdminId && dto.role && dto.role !== AdminRole.super_admin) {
      throw new ConflictException('Không thể tự hạ quyền của chính mình.');
    }
    return this.prisma.admin.update({
      where: { id },
      data: dto,
      select: adminSelect,
    });
  }

  async remove(id: string, currentAdminId: string) {
    await this.getById(id);
    if (id === currentAdminId) {
      throw new ConflictException('Không thể xóa tài khoản của chính mình.');
    }
    await this.prisma.admin.delete({ where: { id } });
  }

  async stats() {
    const [total, superAdminCount, staffCount] = await Promise.all([
      this.prisma.admin.count(),
      this.prisma.admin.count({ where: { role: AdminRole.super_admin } }),
      this.prisma.admin.count({ where: { role: AdminRole.staff } }),
    ]);
    return { total, superAdminCount, staffCount };
  }
}
