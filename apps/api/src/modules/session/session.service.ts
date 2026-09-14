import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import {
  BadRequestException,
  ForbiddenException,
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

export type SessionDeviceInfo = {
  id: string;
  deviceId: string;
  deviceName: string;
  ipAddress: string;
  lastActiveAt: Date;
  createdAt: Date;
  isCurrent: boolean;
};

function parseDeviceName(userAgent: string | null | undefined): string {
  if (!userAgent) return 'Thiết bị không xác định';
  const ua = userAgent.toLowerCase();

  let os = 'Unknown OS';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
  else if (ua.includes('linux')) os = 'Linux';

  let browser = 'trình duyệt';
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome/') && !ua.includes('edg/')) browser = 'Chrome';
  else if (ua.includes('firefox/')) browser = 'Firefox';
  else if (ua.includes('safari/') && !ua.includes('chrome/')) browser = 'Safari';

  return `${browser} trên ${os}`;
}

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
    userAgent?: string,
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
        userAgent,
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
      where: { id: sessionId, userId, expiredAt: { gt: new Date() }, revokedAt: null },
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

    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    });

    return { sessionId: session.id, userId };
  }

  /** Danh sách thiết bị đăng nhập còn hiệu lực của user, thiết bị hiện tại lên đầu. */
  async listSessions(userId: string, currentDeviceId?: string): Promise<SessionDeviceInfo[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiredAt: { gt: new Date() } },
      orderBy: { lastActiveAt: 'desc' },
    });

    return sessions
      .map((s) => ({
        id: s.id,
        deviceId: s.deviceId,
        deviceName: parseDeviceName(s.userAgent),
        ipAddress: s.ipAddress,
        lastActiveAt: s.lastActiveAt,
        createdAt: s.createdAt,
        isCurrent: !!currentDeviceId && s.deviceId === currentDeviceId,
      }))
      .sort((a, b) => (a.isCurrent === b.isCurrent ? 0 : a.isCurrent ? -1 : 1));
  }

  /** Thu hồi (đăng xuất) một thiết bị — chỉ chủ sở hữu session mới revoke được. Soft-delete để giữ audit trail. */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const existing = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!existing) {
      throw new NotFoundException({
        message: 'Không tìm thấy phiên.',
        code: 'SESSION_NOT_FOUND',
      });
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException({
        message: 'Bạn không có quyền thu hồi phiên này.',
        code: 'SESSION_FORBIDDEN',
      });
    }
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
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