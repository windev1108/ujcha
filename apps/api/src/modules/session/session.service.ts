import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Session } from '@prisma/client';
import { JWT_ENV } from '../auth/config/jwt.config';
import { OTP_DEFAULTS, OTP_ENV } from '../otp/config/otp.config';
import { PrismaService } from '../prisma/prisma.service';

export type ValidatedRefreshContext = {
  sessionId: string;
  userId: string;
};

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) { }

  async createSession(
    userId: string,
    refreshTokenPlain: string,
    deviceId: string,
    ipAddress: string,
  ): Promise<Session> {
    const rounds = this.getBcryptRounds();
    const hashed = await bcrypt.hash(refreshTokenPlain, rounds);
    const expiredAt = this.expiredAtFromRefreshJwt(refreshTokenPlain);

    return this.prisma.session.create({
      data: {
        userId,
        refreshToken: hashed,
        deviceId,
        ipAddress,
        expiredAt,
      },
    });
  }

  /**
   * Xác minh JWT refresh + khớp phiên trong DB (nhiều thiết bị: so khớp từng session).
   */
  async validateRefreshToken(refreshTokenPlain: string): Promise<ValidatedRefreshContext> {
    const secret = this.config.getOrThrow<string>(JWT_ENV.REFRESH_SECRET);
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(refreshTokenPlain, secret) as jwt.JwtPayload;
    } catch {
      throw new UnauthorizedException({
        message: 'Refresh token không hợp lệ hoặc đã hết hạn.',
        code: 'REFRESH_TOKEN_INVALID',
      });
    }

    const userId = payload.sub;
    if (!userId || typeof userId !== 'string') {
      throw new UnauthorizedException({
        message: 'Refresh token thiếu subject.',
        code: 'REFRESH_TOKEN_SUB_MISSING',
      });
    }

    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        expiredAt: { gt: new Date() },
      },
    });

    for (const s of sessions) {
      const match = await bcrypt.compare(refreshTokenPlain, s.refreshToken);
      if (match) {
        return { sessionId: s.id, userId };
      }
    }

    throw new UnauthorizedException({
      message: 'Phiên không tồn tại hoặc refresh token đã bị thu hồi.',
      code: 'REFRESH_SESSION_MISMATCH',
    });
  }

  async revokeSession(sessionId: string): Promise<void> {
    const existing = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!existing) {
      throw new NotFoundException({
        message: 'Không tìm thấy phiên.',
        code: 'SESSION_NOT_FOUND',
      });
    }
    await this.prisma.session.delete({ where: { id: sessionId } });
  }

  private expiredAtFromRefreshJwt(token: string): Date {
    const decoded = jwt.decode(token) as jwt.JwtPayload | null;
    const exp = decoded?.exp;
    if (!exp || typeof exp !== 'number') {
      throw new BadRequestException({
        message: 'Refresh token thiếu thời hết hạn (exp).',
        code: 'REFRESH_TOKEN_EXP_MISSING',
      });
    }
    return new Date(exp * 1000);
  }

  private getBcryptRounds(): number {
    const raw = this.config.get<string>(OTP_ENV.BCRYPT_SALT_ROUNDS);
    const n = raw !== undefined ? Number(raw) : OTP_DEFAULTS.BCRYPT_SALT_ROUNDS;
    if (!Number.isFinite(n)) return OTP_DEFAULTS.BCRYPT_SALT_ROUNDS;
    const rounded = Math.floor(n);
    if (rounded < 10 || rounded > 15) return OTP_DEFAULTS.BCRYPT_SALT_ROUNDS;
    return rounded;
  }
}
