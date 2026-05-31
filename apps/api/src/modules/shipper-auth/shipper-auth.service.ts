import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { SignOptions } from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { SHIPPER_JWT_ENV, SHIPPER_JWT_DEFAULTS } from './config/shipper-jwt.config';
import {
  SHIPPER_JWT_TYPE,
  SHIPPER_JWT_REFRESH_TYPE,
  type ShipperJwtPayload,
  type ShipperRefreshJwtPayload,
} from './shipper-jwt.types';
import type { ShipperLoginDto } from './dto/shipper-login.dto';
import type { ShipperRefreshDto } from './dto/shipper-refresh.dto';

@Injectable()
export class ShipperAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private signAccess(adminId: string, shipperId: string): Promise<string> {
    const payload: ShipperJwtPayload = { sub: adminId, shipperId, typ: SHIPPER_JWT_TYPE };
    return this.jwt.signAsync(payload);
  }

  private signRefresh(adminId: string, shipperId: string): Promise<string> {
    const payload: ShipperRefreshJwtPayload = { sub: adminId, shipperId, typ: SHIPPER_JWT_REFRESH_TYPE };
    const secret = this.config.getOrThrow<string>(SHIPPER_JWT_ENV.REFRESH_SECRET);
    const expiresIn = (this.config.get<string>(SHIPPER_JWT_ENV.REFRESH_EXPIRES) ??
      SHIPPER_JWT_DEFAULTS.REFRESH_EXPIRES) as SignOptions['expiresIn'];
    return this.jwt.signAsync(payload, { secret, expiresIn });
  }

  async login(dto: ShipperLoginDto) {
    const phone = dto.phone.trim();

    const admin = await this.prisma.admin.findUnique({
      where: { phone },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        password: true,
        isActive: true,
        shipper: { select: { id: true, isActive: true, name: true, phone: true } },
      },
    });

    if (!admin || !admin.password) {
      throw new UnauthorizedException({
        message: 'Số điện thoại hoặc mật khẩu không đúng.',
        code: 'SHIPPER_INVALID_CREDENTIALS',
      });
    }

    const isMatch = await bcrypt.compare(dto.password, admin.password);
    if (!isMatch || !admin.isActive) {
      throw new UnauthorizedException({
        message: 'Số điện thoại hoặc mật khẩu không đúng.',
        code: 'SHIPPER_INVALID_CREDENTIALS',
      });
    }

    if (!admin.shipper) {
      throw new UnauthorizedException({
        message: 'Tài khoản chưa được đăng ký làm shipper.',
        code: 'SHIPPER_NOT_REGISTERED',
      });
    }

    if (!admin.shipper.isActive) {
      throw new UnauthorizedException({
        message: 'Tài khoản shipper đã bị vô hiệu hóa.',
        code: 'SHIPPER_INACTIVE',
      });
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.signAccess(admin.id, admin.shipper.id),
      this.signRefresh(admin.id, admin.shipper.id),
    ]);

    return {
      accessToken,
      refreshToken,
      shipper: {
        id: admin.shipper.id,
        name: admin.shipper.name,
        phone: admin.shipper.phone,
        email: admin.email,
      },
    };
  }

  async refresh(dto: ShipperRefreshDto) {
    let payload: ShipperRefreshJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<ShipperRefreshJwtPayload>(dto.refreshToken, {
        secret: this.config.getOrThrow<string>(SHIPPER_JWT_ENV.REFRESH_SECRET),
      });
    } catch {
      throw new UnauthorizedException({
        message: 'Refresh token không hợp lệ hoặc đã hết hạn.',
        code: 'SHIPPER_REFRESH_INVALID',
      });
    }

    if (payload.typ !== SHIPPER_JWT_REFRESH_TYPE) {
      throw new UnauthorizedException({ message: 'Token không hợp lệ.', code: 'SHIPPER_REFRESH_WRONG_TYPE' });
    }

    const shipper = await this.prisma.shipper.findUnique({
      where: { id: payload.shipperId },
      select: { id: true, isActive: true, name: true, phone: true, admin: { select: { phone: true } } },
    });

    if (!shipper || !shipper.isActive) {
      throw new UnauthorizedException({ message: 'Shipper không hoạt động.', code: 'SHIPPER_INACTIVE' });
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.signAccess(payload.sub, payload.shipperId),
      this.signRefresh(payload.sub, payload.shipperId),
    ]);

    return {
      accessToken,
      refreshToken,
      shipper: {
        id: shipper.id,
        name: shipper.name,
        phone: shipper.phone,
      },
    };
  }

  async updatePhone(shipperId: string, phone: string) {
    const updated = await this.prisma.shipper.update({
      where: { id: shipperId },
      data: { phone: phone.trim() || null },
      select: { phone: true },
    });
    return { phone: updated.phone };
  }

  async getMe(shipperId: string) {
    const shipper = await this.prisma.shipper.findUnique({
      where: { id: shipperId },
      select: {
        id: true,
        name: true,
        phone: true,
        isActive: true,
        admin: { select: { phone: true, faceProfile: { select: { imageUrl: true } } } },
      },
    });
    if (!shipper) throw new UnauthorizedException({ message: 'Không tìm thấy shipper.', code: 'SHIPPER_NOT_FOUND' });
    return {
      id: shipper.id,
      name: shipper.name,
      phone: shipper.phone,
      imageUrl: shipper.admin?.faceProfile?.imageUrl ?? null,
    };
  }
}
