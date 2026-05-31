import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { SignOptions } from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';
import { ADMIN_JWT_ENV, ADMIN_JWT_DEFAULTS } from './config/admin-jwt.config';
import {
  ADMIN_JWT_REFRESH_TYPE,
  ADMIN_JWT_TYPE,
  type AdminJwtPayload,
  type AdminRefreshJwtPayload,
} from './admin-jwt.types';
import type { AdminPhoneLoginDto } from './dto/admin-phone-login.dto';
import type { AdminRefreshDto } from './dto/admin-refresh.dto';

type AdminRow = {
  id: string;
  phone: string | null;
  name: string | null;
  role: AdminJwtPayload['role'];
  permissions: string[];
};

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  private async signAccessToken(admin: Pick<AdminRow, 'id' | 'role' | 'permissions'>): Promise<string> {
    const payload: AdminJwtPayload = {
      sub: admin.id,
      role: admin.role,
      typ: ADMIN_JWT_TYPE,
      permissions: admin.permissions,
    };
    return this.jwtService.signAsync(payload);
  }

  private async signRefreshToken(admin: Pick<AdminRow, 'id' | 'role'>): Promise<string> {
    const payload: AdminRefreshJwtPayload = {
      sub: admin.id,
      role: admin.role,
      typ: ADMIN_JWT_REFRESH_TYPE,
    };
    const secret = this.config.getOrThrow<string>(ADMIN_JWT_ENV.REFRESH_SECRET);
    const expiresIn = (this.config.get<string>(ADMIN_JWT_ENV.REFRESH_EXPIRES) ??
      ADMIN_JWT_DEFAULTS.REFRESH_EXPIRES) as SignOptions['expiresIn'];
    return this.jwtService.signAsync(payload, { secret, expiresIn });
  }

  private dto(admin: AdminRow) {
    return { id: admin.id, phone: admin.phone, name: admin.name, role: admin.role, permissions: admin.permissions };
  }

  async loginWithPhone(dto: AdminPhoneLoginDto) {
    const phone = dto.phone.trim();

    const admin = await this.prisma.admin.findUnique({
      where: { phone },
      select: { id: true, phone: true, name: true, role: true, password: true, permissions: true, isActive: true },
    });

    if (!admin || !admin.password) {
      throw new UnauthorizedException({
        message: 'Số điện thoại hoặc mật khẩu không đúng.',
        code: 'ADMIN_INVALID_CREDENTIALS',
      });
    }

    if (!admin.isActive) {
      throw new UnauthorizedException({
        message: 'Tài khoản đã bị vô hiệu hoá.',
        code: 'ADMIN_INACTIVE',
      });
    }

    const isMatch = await bcrypt.compare(dto.password, admin.password);
    if (!isMatch) {
      throw new UnauthorizedException({
        message: 'Số điện thoại hoặc mật khẩu không đúng.',
        code: 'ADMIN_INVALID_CREDENTIALS',
      });
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(admin),
      this.signRefreshToken(admin),
    ]);

    return { accessToken, refreshToken, admin: this.dto(admin) };
  }

  async refreshTokens(dto: AdminRefreshDto) {
    let payload: AdminRefreshJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<AdminRefreshJwtPayload>(dto.refreshToken, {
        secret: this.config.getOrThrow<string>(ADMIN_JWT_ENV.REFRESH_SECRET),
      });
    } catch {
      throw new UnauthorizedException({
        message: 'Refresh token không hợp lệ hoặc đã hết hạn.',
        code: 'ADMIN_REFRESH_INVALID',
      });
    }

    if (payload.typ !== ADMIN_JWT_REFRESH_TYPE) {
      throw new UnauthorizedException({
        message: 'Token không phải refresh admin.',
        code: 'ADMIN_REFRESH_WRONG_TYPE',
      });
    }

    const admin = await this.prisma.admin.findUnique({
      where: { id: payload.sub },
      select: { id: true, phone: true, name: true, role: true, permissions: true, isActive: true },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException({ message: 'Không tìm thấy tài khoản admin.', code: 'ADMIN_NOT_FOUND' });
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(admin),
      this.signRefreshToken(admin),
    ]);

    return { accessToken, refreshToken, admin: this.dto(admin) };
  }

  async getMe(adminId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: { id: true, phone: true, name: true, role: true, permissions: true },
    });
    if (!admin) {
      throw new UnauthorizedException({ message: 'Không tìm thấy tài khoản admin.', code: 'ADMIN_NOT_FOUND' });
    }
    return { admin };
  }
}
