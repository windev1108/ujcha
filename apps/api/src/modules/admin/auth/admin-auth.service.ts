import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleAuthService } from '../../google-auth/google-auth.service';
import { ADMIN_JWT_ENV, ADMIN_JWT_DEFAULTS } from './config/admin-jwt.config';
import {
  ADMIN_JWT_REFRESH_TYPE,
  ADMIN_JWT_TYPE,
  type AdminJwtPayload,
  type AdminRefreshJwtPayload,
} from './admin-jwt.types';
import type { AdminGoogleLoginDto } from './dto/admin-google-login.dto';
import type { AdminRefreshDto } from './dto/admin-refresh.dto';
import { AdminEmailLoginDto } from './dto/admin-email-login.dto';

type AdminTokenRow = { id: string; email: string; role: AdminJwtPayload['role']; permissions: string[] };

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly googleAuthService: GoogleAuthService,
  ) { }

  private async signAccessToken(admin: Pick<AdminTokenRow, 'id' | 'role' | 'permissions'>): Promise<string> {
    const payload: AdminJwtPayload = {
      sub: admin.id,
      role: admin.role,
      typ: ADMIN_JWT_TYPE,
      permissions: admin.permissions,
    };
    return this.jwtService.signAsync(payload);
  }

  private async signRefreshToken(admin: Pick<AdminTokenRow, 'id' | 'role'>): Promise<string> {
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

  async loginWithGoogle(dto: AdminGoogleLoginDto) {
    const profile = await this.googleAuthService.verifyGoogleIdToken(dto.idToken);
    const email = profile.email.trim().toLowerCase();

    const admin = await this.prisma.admin.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, googleId: true, permissions: true },
    });

    if (!admin) {
      throw new UnauthorizedException({
        message: 'Tài khoản Google chưa được cấp quyền admin.',
        code: 'ADMIN_GOOGLE_NOT_ALLOWED',
      });
    }

    if (admin.googleId && admin.googleId !== profile.googleId) {
      throw new UnauthorizedException({
        message: 'Tài khoản Google không khớp với hồ sơ admin.',
        code: 'ADMIN_GOOGLE_MISMATCH',
      });
    }

    if (!admin.googleId) {
      await this.prisma.admin.update({
        where: { id: admin.id },
        data: { googleId: profile.googleId },
      });
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(admin),
      this.signRefreshToken(admin),
    ]);

    return {
      accessToken,
      refreshToken,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
      },
    };
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
      select: { id: true, email: true, role: true, permissions: true },
    });

    if (!admin) {
      throw new UnauthorizedException({
        message: 'Không tìm thấy tài khoản admin.',
        code: 'ADMIN_NOT_FOUND',
      });
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(admin),
      this.signRefreshToken(admin),
    ]);

    return {
      accessToken,
      refreshToken,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
      },
    };
  }

  async loginWithEmail(dto: AdminEmailLoginDto) {
    const email = dto.email.trim().toLowerCase();

    const admin = await this.prisma.admin.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        password: true,
        permissions: true,
      },
    });

    if (!admin || !admin.password) {
      throw new UnauthorizedException({
        message: 'Email hoặc mật khẩu không đúng.',
        code: 'ADMIN_INVALID_CREDENTIALS',
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const isMatch = dto.password === admin.password;
    if (!isMatch) {
      throw new UnauthorizedException({
        message: 'Email hoặc mật khẩu không đúng.',
        code: 'ADMIN_INVALID_CREDENTIALS',
      });
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(admin),
      this.signRefreshToken(admin),
    ]);

    return {
      accessToken,
      refreshToken,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
      },
    };
  }

  async getMe(adminId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: { id: true, email: true, role: true, permissions: true },
    });

    if (!admin) {
      throw new UnauthorizedException({
        message: 'Không tìm thấy tài khoản admin.',
        code: 'ADMIN_NOT_FOUND',
      });
    }

    return { admin };
  }
}
