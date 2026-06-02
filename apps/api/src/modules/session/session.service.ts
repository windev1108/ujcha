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
import type { JwtRefreshPayload } from '../auth/jwt.types';
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
    sessionId: string,
  ): Promise<Session> {
    const rounds = this.getBcryptRounds();
    const hashed = await bcrypt.hash(refreshTokenPlain, rounds);
    const expiredAt = this.expiredAtFromRefreshJwt(refreshTokenPlain);

    return this.prisma.session.create({
      data: {
        id: sessionId,
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
    let payload: JwtRefreshPayload;
    try {
      payload = jwt.verify(refreshTokenPlain, secret) as JwtRefreshPayload;
    } catch {
      throw new UnauthorizedException({
        message: 'Refresh token không hợp lệ hoặc đã hết hạn.',
        code: 'REFRESH_TOKEN_INVALID',
      });
    }

    const userId = payload.sub;
    const sessionId = payload.sid;
    if (!userId || typeof userId !== 'string' || !sessionId) {
      throw new UnauthorizedException({
        message: 'Refresh token thiếu thông tin.',
        code: 'REFRESH_TOKEN_INVALID',
      });
    }

    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId, expiredAt: { gt: new Date() } },
    });

    if (!session) {
      throw new UnauthorizedException({
        message: 'Phiên không tồn tại hoặc refresh token đã bị thu hồi.',
        code: 'REFRESH_SESSION_MISMATCH',
      });
    }

    const match = await bcrypt.compare(refreshTokenPlain, session.refreshToken);
    if (!match) {
      throw new UnauthorizedException({
        message: 'Phiên không tồn tại hoặc refresh token đã bị thu hồi.',
        code: 'REFRESH_SESSION_MISMATCH',
      });
    }

    return { sessionId: session.id, userId };
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
