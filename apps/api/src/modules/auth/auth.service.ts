import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { FraudService } from '../fraud/fraud.service';
import { JwtTokensService } from './jwt-tokens.service';
import { OtpService } from '../otp/otp.service';
import { SessionService } from '../session/session.service';
import { SmsService } from '../sms/sms.service';
import { UserService } from '../user/user.service';
import { PointService } from '../point/point.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthResult = {
  user: User;
} & AuthTokens;

export type SessionContext = {
  deviceId: string;
  ipAddress: string;
  userAgent?: string;
  refCode?: string;
};

const BCRYPT_ROUNDS = 10;
const MAX_LOGIN_ATTEMPTS = 10;
const LOCK_MINUTES = 30;
const LOCK_SECONDS = LOCK_MINUTES * 60;

const failKey = (key: string) => `login:fail:${key}`;
const lockKey = (key: string) => `login:lock:${key}`;
@Injectable()
export class AuthService {
  constructor(
    private readonly otpService: OtpService,
    private readonly userService: UserService,
    private readonly jwtTokensService: JwtTokensService,
    private readonly sessionService: SessionService,
    private readonly smsService: SmsService,
    private readonly fraudService: FraudService,
    private readonly pointService: PointService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) { }

  /** Gửi OTP để đăng ký hoặc quên mật khẩu. */
  async sendOtp(
    phone: string,
    requestIp: string,
    purpose?: 'register' | 'reset',
  ): Promise<void> {
    if (purpose === 'reset') {
      const user = await this.userService.findByPhone(phone);
      if (!user) {
        throw new NotFoundException({
          message: 'Số điện thoại chưa được đăng ký.',
          code: 'USER_NOT_FOUND',
        });
      }
    }
    const { code } = await this.otpService.generateOtp(phone, requestIp);
    await this.smsService.sendOtp(phone, code);
  }

  /**
   * Đăng ký tài khoản mới:
   * 1. Kiểm tra SĐT chưa tồn tại.
   * 2. Xác minh OTP.
   * 3. Tạo user với password đã hash.
   */
  async register(
    phone: string,
    name: string,
    password: string,
    code: string,
    ctx: SessionContext,
  ): Promise<AuthResult> {
    const existing = await this.userService.findByPhone(phone);
    if (existing) {
      throw new ConflictException({
        message: 'Số điện thoại đã được đăng ký.',
        code: 'PHONE_ALREADY_EXISTS',
      });
    }

    await this.otpService.verifyOtp(phone, code);
    await this.fraudService.assertNewAccountAllowedOnDevice(ctx.deviceId);

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const referralCode = await this.userService.generateUniqueReferralCode();
    const referredBy = ctx.refCode
      ? await this.resolveRefCode(ctx.refCode)
      : undefined;

    const user = await this.userService.createUser({
      phone,
      name,
      password: passwordHash,
      referralCode,
      referredBy,
      registrationIp: ctx.ipAddress,
      registrationDeviceId: ctx.deviceId,
      phoneVerifiedAt: new Date(),
    });

    try {
      await this.pointService.grantSignupBonus(user.id);
    } catch (e) {
      console.error('[WelcomeVoucher]', e);
    }

    return this.issueTokensAndSession(user, ctx);
  }

  /** Đăng nhập bằng số điện thoại + mật khẩu. */
  async loginWithPassword(
    phone: string,
    password: string,
    ctx: SessionContext,
  ): Promise<AuthResult> {
    const user = await this.userService.findByPhone(phone);
    if (!user) {
      throw new UnauthorizedException({
        message: 'Số điện thoại chưa được đăng ký.',
        code: 'USER_NOT_FOUND',
      });
    }

    if (!user.password) {
      throw new UnauthorizedException({
        message: 'Tài khoản này chưa thiết lập mật khẩu.',
        code: 'PASSWORD_NOT_SET',
      });
    }

    const key = `${ctx.ipAddress}:${ctx.deviceId}`;
    await this.assertNotLocked(key);

    const matches = await bcrypt.compare(password, user.password);
    if (!matches) return this.registerFailedLogin(key); // luôn throw

    await this.redis.del(failKey(key));
    return this.issueTokensAndSession(user, ctx);
  }

  private async assertNotLocked(key: string) {
    const lock = await this.redis.get<{ lockedUntil: string }>(lockKey(key));
    if (!lock) return; // key hết TTL là tự mở khoá
    const lockedUntil = new Date(lock.lockedUntil);
    if (lockedUntil > new Date())
      throw this.accountLockedException(lockedUntil);
  }

  private async registerFailedLogin(key: string): Promise<never> {
    const count = await this.redis.incrementWindow(failKey(key), LOCK_SECONDS);
    const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - count);

    if (count >= MAX_LOGIN_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCK_SECONDS * 1000);
      await this.redis.set(
        lockKey(key),
        { lockedUntil: lockedUntil.toISOString() },
        LOCK_SECONDS,
      );
      await this.redis.del(failKey(key));
      throw this.accountLockedException(lockedUntil);
    }

    throw new UnauthorizedException({
      message: 'Mật khẩu không đúng.',
      code: 'INVALID_PASSWORD',
      remainingAttempts: remaining,
      maxAttempts: MAX_LOGIN_ATTEMPTS,
    });
  }

  private accountLockedException(lockedUntil: Date) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((lockedUntil.getTime() - Date.now()) / 1000),
    );
    return new HttpException(
      {
        message: 'Tài khoản tạm khoá do nhập sai mật khẩu quá nhiều lần.',
        code: 'ACCOUNT_LOCKED',
        lockedUntil: lockedUntil.toISOString(),
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  /** Đặt lại mật khẩu qua OTP (quên mật khẩu). */
  async resetPassword(
    phone: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userService.findByPhone(phone);
    if (!user) {
      throw new NotFoundException({
        message: 'Số điện thoại chưa được đăng ký.',
        code: 'USER_NOT_FOUND',
      });
    }

    await this.otpService.verifyOtp(phone, code);

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.userService.updateUser(user.id, { password: passwordHash });

    await Promise.all([
      this.redis.delByPattern(`login:fail:${user.id}:*`),
      this.redis.delByPattern(`login:lock:${user.id}:*`),
    ]);
    await this.sessionService.revokeAllSessions(user.id, 'password_reset');
  }

  /** Đổi mật khẩu khi đã đăng nhập. Sau khi đổi thành công, thu hồi mọi session khác để bảo vệ tài khoản. */
  async changePassword(
    userId: string,
    currentPassword: string | undefined,
    newPassword: string,
    currentSessionId?: string,
  ): Promise<void> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException({
        message: 'Không tìm thấy user.',
        code: 'USER_NOT_FOUND',
      });
    }

    if (user.password) {
      if (!currentPassword) {
        throw new UnauthorizedException({
          message: 'Vui lòng nhập mật khẩu hiện tại.',
          code: 'CURRENT_PASSWORD_REQUIRED',
        });
      }
      const matches = await bcrypt.compare(currentPassword, user.password);
      if (!matches) {
        throw new UnauthorizedException({
          message: 'Mật khẩu hiện tại không đúng.',
          code: 'INVALID_CURRENT_PASSWORD',
        });
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.userService.updateUser(user.id, { password: passwordHash });

    const revokedCount = await this.sessionService.revokeAllSessions(
      userId,
      'password_change',
      currentSessionId,
    );
    if (revokedCount > 0) {
      console.log(
        `[ChangePassword] Revoked ${revokedCount} other session(s) for user ${userId}`,
      );
    }
  }

  /** Xác minh refresh token + phiên, cấp access token mới. */
  async refreshToken(refreshTokenPlain: string): Promise<AuthTokens> {
    const { userId, sessionId, newRefreshTokenPlain } =
      await this.sessionService.validateAndRotateRefreshToken(
        refreshTokenPlain,
      );
    const accessToken = await this.jwtTokensService.generateAccessToken(
      userId,
      sessionId,
    );
    return { accessToken, refreshToken: newRefreshTokenPlain };
  }

  async listSessions(userId: string, currentDeviceId?: string) {
    return this.sessionService.listSessions(userId, currentDeviceId);
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.sessionService.revokeSession(userId, sessionId);
  }

  private async resolveRefCode(refCode: string): Promise<string | undefined> {
    const referrer = await this.userService.findByReferralCode(
      refCode.toUpperCase(),
    );
    return referrer ? refCode.toUpperCase() : undefined;
  }

  private async issueTokensAndSession(
    user: User,
    ctx: SessionContext,
  ): Promise<AuthResult> {
    const sessionId = randomUUID();
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtTokensService.generateAccessToken(user.id, sessionId),
      this.jwtTokensService.generateRefreshToken(user.id, sessionId),
    ]);

    await this.sessionService.createSession(
      user.id,
      refreshToken,
      ctx.deviceId,
      ctx.ipAddress,
      sessionId,
      ctx.userAgent,
    );

    let next = await this.userService.ensureRegistrationMetadata(
      user.id,
      ctx.ipAddress,
      ctx.deviceId,
    );
    next = await this.fraudService.evaluateUserAfterSignup(next);

    return { user: next, accessToken, refreshToken };
  }
}
