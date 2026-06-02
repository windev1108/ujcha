import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { FraudService } from '../fraud/fraud.service';
import { GoogleAuthService } from '../google-auth/google-auth.service';
import { JwtTokensService } from './jwt-tokens.service';
import { OtpService } from '../otp/otp.service';
import { SessionService } from '../session/session.service';
import { SmsService } from '../sms/sms.service';
import { UserService } from '../user/user.service';
import { UserVoucherService } from '../voucher/user-voucher.service';

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
  refCode?: string;
};

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly otpService: OtpService,
    private readonly userService: UserService,
    private readonly jwtTokensService: JwtTokensService,
    private readonly sessionService: SessionService,
    private readonly smsService: SmsService,
    private readonly fraudService: FraudService,
    private readonly userVoucherService: UserVoucherService,
    private readonly googleAuthService: GoogleAuthService,
  ) { }

  /** Gửi OTP để đăng ký hoặc quên mật khẩu. */
  async sendOtp(phone: string, requestIp: string): Promise<void> {
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
    const referredBy = ctx.refCode ? await this.resolveRefCode(ctx.refCode) : undefined;

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
      await this.userVoucherService.grantWelcomeVoucher(user.id);
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
        message: 'Tài khoản này chưa thiết lập mật khẩu. Hãy dùng "Quên mật khẩu" để tạo mới.',
        code: 'PASSWORD_NOT_SET',
      });
    }

    const matches = await bcrypt.compare(password, user.password);
    if (!matches) {
      throw new UnauthorizedException({
        message: 'Mật khẩu không đúng.',
        code: 'INVALID_PASSWORD',
      });
    }

    return this.issueTokensAndSession(user, ctx);
  }

  /** Đặt lại mật khẩu qua OTP (quên mật khẩu). */
  async resetPassword(phone: string, code: string, newPassword: string): Promise<void> {
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
  }

  /** Xác minh refresh token + phiên, cấp access token mới. */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    const { userId } = await this.sessionService.validateRefreshToken(refreshToken);
    const accessToken = await this.jwtTokensService.generateAccessToken(userId);
    return { accessToken };
  }

  async loginWithGoogle(
    idToken: string,
    ctx: SessionContext,
  ): Promise<AuthResult> {
    const user = await this.googleAuthService.signInWithIdToken(idToken, ctx);
    return this.issueTokensAndSession(user, ctx);
  }

  private async resolveRefCode(refCode: string): Promise<string | undefined> {
    const referrer = await this.userService.findByReferralCode(refCode.toUpperCase());
    return referrer ? refCode.toUpperCase() : undefined;
  }

  private async issueTokensAndSession(
    user: User,
    ctx: SessionContext,
  ): Promise<AuthResult> {
    const sessionId = randomUUID();
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtTokensService.generateAccessToken(user.id),
      this.jwtTokensService.generateRefreshToken(user.id, sessionId),
    ]);

    await this.sessionService.createSession(
      user.id,
      refreshToken,
      ctx.deviceId,
      ctx.ipAddress,
      sessionId,
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
