import { randomBytes } from 'node:crypto';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) { }

  findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { googleId } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByReferralCode(referralCode: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { referralCode } });
  }

  createUser(data: Prisma.UserUncheckedCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  updateUser(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  /** Ghi nhận IP/device lần đầu (user cũ chưa có registration metadata). */
  async ensureRegistrationMetadata(
    userId: string,
    ip: string,
    deviceId: string,
  ): Promise<User> {
    const u = await this.findById(userId);
    if (!u) {
      throw new NotFoundException({ message: 'Không tìm thấy user.', code: 'USER_NOT_FOUND' });
    }
    if (!u.registrationIp) {
      return this.updateUser(userId, {
        registrationIp: ip,
        registrationDeviceId: deviceId,
      });
    }
    return u;
  }

  async generateUniqueReferralCode(): Promise<string> {
    for (let i = 0; i < 24; i++) {
      const code = randomBytes(8).toString('hex').slice(0, 12).toUpperCase();
      const exists = await this.findByReferralCode(code);
      if (!exists) return code;
    }
    throw new InternalServerErrorException({
      message: 'Không tạo được mã giới thiệu duy nhất.',
      code: 'REFERRAL_CODE_GENERATION_FAILED',
    });
  }

  /**
   * Tìm **User** (khách ứng dụng) — model `User`, không dùng bảng `Admin`.
   * Phục vụ POS / gắn khách khi tạo đơn.
   */
  async searchCustomersForAdmin(q?: string) {
    const qx = q?.trim();
    return this.prisma.user.findMany({
      where: qx
        ? {
          OR: [
            { name: { contains: qx, mode: 'insensitive' } },
            { phone: { contains: qx, mode: 'insensitive' } },
            { email: { contains: qx, mode: 'insensitive' } },
          ],
        }
        : {},
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        pointBalance: true,
      },
    });
  }

  /**
   * Danh sách khách hàng có phân trang cho trang quản trị.
   */
  async listCustomersPaginated(opts: {
    q?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { q, page = 1, pageSize = 10 } = opts;
    const qx = q?.trim();
    const skip = (page - 1) * pageSize;

    const where = qx
      ? {
          OR: [
            { name: { contains: qx, mode: 'insensitive' as const } },
            { phone: { contains: qx, mode: 'insensitive' as const } },
            { email: { contains: qx, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          avatar: true,
          pointBalance: true,
          referralCode: true,
          createdAt: true,
          suspiciousAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Địa chỉ giao của **User** (khách). `userId` là id bảng `User`, không phải `Admin`.
   */
  async listCustomerAddressesForAdmin(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!u) {
      throw new NotFoundException({
        message: 'Không tìm thấy khách.',
        code: 'USER_NOT_FOUND',
      });
    }
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        fullAddress: true,
        note: true,
        isDefault: true,
      },
    });
  }
}
