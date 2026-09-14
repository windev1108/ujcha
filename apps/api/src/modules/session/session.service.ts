import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
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

export type RevokeReason =
  | 'logout'
  | 'password_change'
  | 'device_limit'
  | 'reuse_detected'
  | 'relogin_same_device'
  | 'user_action';

const MAX_SESSIONS_PER_USER = 5;

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
  else if (ua.includes('safari/') && !ua.includes('chrome/'))
    browser = 'Safari';

  return `${browser} trên ${os}`;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Tạo session mới khi login/register/google-login.
   * - Revoke session active khác trên CÙNG deviceId (tránh rác khi user login lại).
   * - Sau khi tạo, nếu vượt quá MAX_SESSIONS_PER_USER → evict session cũ nhất (LRU).
   */
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

    return this.prisma.$transaction(async (tx) => {
      // 1. Dedupe: revoke session active cũ trên cùng device
      await tx.session.updateMany({
        where: { userId, deviceId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'relogin_same_device' },
      });

      // 2. Tạo session mới
      const session = await tx.session.create({
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

      // 3. Enforce limit — evict session cũ nhất nếu vượt quá
      const activeSessions = await tx.session.findMany({
        where: { userId, revokedAt: null, expiredAt: { gt: new Date() } },
        orderBy: { lastActiveAt: 'desc' },
        select: { id: true },
      });

      if (activeSessions.length > MAX_SESSIONS_PER_USER) {
        const toEvict = activeSessions
          .slice(MAX_SESSIONS_PER_USER)
          .map((s) => s.id);
        await tx.session.updateMany({
          where: { id: { in: toEvict } },
          data: { revokedAt: new Date(), revokedReason: 'device_limit' },
        });
        this.logger.log(
          `Evicted ${toEvict.length} old session(s) for user ${userId} (limit=${MAX_SESSIONS_PER_USER})`,
        );
      }

      return session;
    });
  }

  /**
   * Verify refresh token + ROTATE: nếu hợp lệ, overwrite hash trong CÙNG session row
   * và trả về session để caller issue token mới. Đây là chuẩn OAuth2 refresh rotation.
   *
   * Reuse detection: nếu refreshTokenPlain không khớp hash hiện tại của session còn active
   * (nghĩa là token này đã bị rotate trước đó, hoặc đã bị revoke) → coi là dấu hiệu bị lộ,
   * revoke toàn bộ session của user để chặn kẻ tấn công.
   */
  async validateAndRotateRefreshToken(
    refreshTokenPlain: string,
  ): Promise<ValidatedRefreshContext & { newRefreshTokenPlain: string }> {
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

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    // Session không tồn tại hoặc đã bị revoke trước đó nhưng token vẫn được gửi lên
    // → khả năng cao là refresh token cũ bị đánh cắp và dùng lại sau khi đã rotate.
    if (
      !session ||
      session.revokedAt ||
      session.userId !== userId ||
      session.expiredAt <= new Date()
    ) {
      if (session && session.userId === userId) {
        this.logger.warn(
          `Possible refresh token reuse detected for user ${userId}, session ${sessionId}`,
        );
        await this.revokeAllSessions(userId, 'reuse_detected');
      }
      throw new UnauthorizedException({
        message: 'Phiên không tồn tại hoặc refresh token đã bị thu hồi.',
        code: 'REFRESH_SESSION_MISMATCH',
      });
    }

    const match = await bcrypt.compare(refreshTokenPlain, session.refreshToken);
    if (!match) {
      // Hash không khớp dù session vẫn active → token đưa lên không phải bản mới nhất
      // (đã bị rotate rồi) → đây chính là dấu hiệu reuse kinh điển.
      this.logger.warn(
        `Refresh token hash mismatch (reuse?) for user ${userId}, session ${sessionId}`,
      );
      await this.revokeAllSessions(userId, 'reuse_detected');
      throw new UnauthorizedException({
        message: 'Phiên không tồn tại hoặc refresh token đã bị thu hồi.',
        code: 'REFRESH_SESSION_MISMATCH',
      });
    }

    // Hợp lệ → rotate: sinh refresh token mới, overwrite hash trong CÙNG row
    const newRefreshTokenPlain = this.signRefreshToken(
      userId,
      sessionId,
      secret,
    );
    const rounds = this.getBcryptRounds();
    const newHashed = await bcrypt.hash(newRefreshTokenPlain, rounds);
    const newExpiredAt = this.expiredAtFromRefreshJwt(newRefreshTokenPlain);

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshToken: newHashed,
        expiredAt: newExpiredAt,
        lastActiveAt: new Date(),
      },
    });

    return { sessionId: session.id, userId, newRefreshTokenPlain };
  }

  /** Danh sách thiết bị đăng nhập còn hiệu lực của user, thiết bị hiện tại lên đầu. */
  async listSessions(
    userId: string,
    currentDeviceId?: string,
  ): Promise<SessionDeviceInfo[]> {
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

  /** Thu hồi 1 session cụ thể — chỉ chủ sở hữu mới revoke được. */
  async revokeSession(
    userId: string,
    sessionId: string,
    reason: RevokeReason = 'user_action',
  ): Promise<void> {
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
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  /**
   * Thu hồi tất cả session của user, tuỳ chọn giữ lại 1 session (thường là session hiện tại
   * khi user chủ động đổi mật khẩu). Dùng cho: đổi mật khẩu, phát hiện reuse, admin force-logout.
   */
  async revokeAllSessions(
    userId: string,
    reason: RevokeReason,
    exceptSessionId?: string,
  ): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return result.count;
  }

  private signRefreshToken(
    userId: string,
    sessionId: string,
    secret: string,
  ): string {
    const expiresIn = this.config.get<string>(JWT_ENV.REFRESH_EXPIRES) ?? '30d';
    return jwt.sign({ sub: userId, sid: sessionId }, secret, {
      expiresIn,
    } as jwt.SignOptions);
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
