import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { OTP_DEFAULTS, OTP_ENV } from '../otp/config/otp.config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { FRAUD_LIMITS, FRAUD_REASON_CODES } from './config/fraud.config';

@Injectable()
export class FraudService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) { }

  /**
   * Giới hạn OTP theo phone và theo IP.
   * Dùng Redis atomic INCR khi available; fallback về DB COUNT nếu Redis offline.
   */
  async assertOtpSendAllowed(phone: string, requestIp: string): Promise<void> {
    const windowMs = this.getOtpWindowMs();
    const windowSeconds = Math.ceil(windowMs / 1000);
    const maxPhone = this.getOtpMaxPerWindow();
    const maxIp = FRAUD_LIMITS.OTP_PER_IP_WINDOW;

    if (this.redis.isAvailable) {
      const phoneCount = await this.redis.incrementWindow(
        `ujcha:otp:phone:${phone}`,
        windowSeconds,
      );
      if (phoneCount > maxPhone) {
        this.throwOtpRateLimit('phone', maxPhone, windowMs);
      }

      if (requestIp && requestIp !== 'unknown') {
        const ipCount = await this.redis.incrementWindow(
          `ujcha:otp:ip:${requestIp}`,
          windowSeconds,
        );
        if (ipCount > maxIp) {
          this.throwOtpRateLimit('ip', maxIp, windowMs);
        }
      }
    } else {
      // Redis offline — fallback to DB
      const since = new Date(Date.now() - windowMs);
      const phoneCount = await this.prisma.otp.count({
        where: { phone, createdAt: { gte: since } },
      });
      if (phoneCount >= maxPhone) {
        this.throwOtpRateLimit('phone', maxPhone, windowMs);
      }

      if (requestIp && requestIp !== 'unknown') {
        const ipCount = await this.prisma.otp.count({
          where: { requestIp, createdAt: { gte: since } },
        });
        if (ipCount >= maxIp) {
          this.throwOtpRateLimit('ip', maxIp, windowMs);
        }
      }
    }
  }

  /**
   * Chặn đăng ký tài khoản mới nếu device đã gắn quá nhiều user (theo session).
   */
  async assertNewAccountAllowedOnDevice(deviceId: string): Promise<void> {
    const groups = await this.prisma.session.groupBy({
      by: ['userId'],
      where: { deviceId },
    });
    if (groups.length >= FRAUD_LIMITS.MAX_DISTINCT_ACCOUNTS_PER_DEVICE) {
      throw new ForbiddenException({
        message: `Thiết bị này đã đạt giới hạn ${FRAUD_LIMITS.MAX_DISTINCT_ACCOUNTS_PER_DEVICE} tài khoản.`,
        code: 'DEVICE_ACCOUNT_LIMIT',
      });
    }
  }

  /**
   * Sau khi user có registrationIp (đăng ký mới), đánh dấu suspicious nếu pattern bất thường.
   */
  async evaluateUserAfterSignup(user: User): Promise<User> {
    if (!user.registrationIp) {
      return user;
    }

    const reasons: string[] = [];

    const rapidSince = new Date(
      Date.now() - FRAUD_LIMITS.RAPID_SIGNUP_WINDOW_MINUTES * 60 * 1000,
    );
    const rapidCount = await this.prisma.user.count({
      where: {
        registrationIp: user.registrationIp,
        createdAt: { gte: rapidSince },
      },
    });
    if (rapidCount >= FRAUD_LIMITS.RAPID_SIGNUP_MAX_ACCOUNTS_SAME_IP) {
      reasons.push(FRAUD_REASON_CODES.RAPID_SIGNUPS_SAME_IP);
    }

    const daySince = new Date(
      Date.now() - FRAUD_LIMITS.SAME_IP_WINDOW_HOURS * 60 * 60 * 1000,
    );
    const dayCount = await this.prisma.user.count({
      where: {
        registrationIp: user.registrationIp,
        createdAt: { gte: daySince },
      },
    });
    if (dayCount >= FRAUD_LIMITS.SAME_IP_MAX_ACCOUNTS) {
      reasons.push(FRAUD_REASON_CODES.MANY_ACCOUNTS_SAME_IP_24H);
    }

    if (reasons.length === 0) {
      return user;
    }

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        suspiciousAt: new Date(),
        suspiciousReason: [...new Set(reasons)].join(','),
      },
    });
  }

  private throwOtpRateLimit(
    kind: 'phone' | 'ip',
    max: number,
    windowMs: number,
  ): never {
    const windowMinutes = windowMs / 60_000;
    throw new HttpException(
      {
        message:
          kind === 'phone'
            ? `Đã vượt giới hạn ${max} mã OTP mỗi ${windowMinutes} phút cho số điện thoại này.`
            : `Đã vượt giới hạn ${max} mã OTP mỗi ${windowMinutes} phút từ địa chỉ IP này.`,
        code: kind === 'phone' ? 'OTP_RATE_LIMIT_PHONE' : 'OTP_RATE_LIMIT_IP',
        retryAfterMinutes: windowMinutes,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private getOtpWindowMs(): number {
    const raw = this.config.get<string>(OTP_ENV.RATE_LIMIT_WINDOW_MINUTES);
    const minutes =
      raw !== undefined ? Number(raw) : OTP_DEFAULTS.RATE_LIMIT_WINDOW_MINUTES;
    const m =
      Number.isFinite(minutes) && minutes > 0 ? minutes : OTP_DEFAULTS.RATE_LIMIT_WINDOW_MINUTES;
    return m * 60 * 1000;
  }

  private getOtpMaxPerWindow(): number {
    const raw = this.config.get<string>(OTP_ENV.RATE_LIMIT_MAX);
    const n = raw !== undefined ? Number(raw) : OTP_DEFAULTS.RATE_LIMIT_MAX;
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : OTP_DEFAULTS.RATE_LIMIT_MAX;
  }
}
