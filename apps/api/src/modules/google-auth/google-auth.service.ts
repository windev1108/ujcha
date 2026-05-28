import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import type { User } from '@prisma/client';
import { FraudService } from '../fraud/fraud.service';
import { GOOGLE_AUTH_ENV } from './config/google-auth.config';
import { UserService } from '../user/user.service';
import { UserVoucherService } from '../voucher/user-voucher.service';

export type GoogleSignInContext = {
  deviceId?: string;
  ipAddress?: string;
  refCode?: string;
};

export type GoogleIdTokenProfile = {
  googleId: string;
  email: string;
  name: string;
  avatar: string | null;
};

@Injectable()
export class GoogleAuthService {
  private readonly oauth: OAuth2Client;

  constructor(
    private readonly config: ConfigService,
    private readonly userService: UserService,
    private readonly fraudService: FraudService,
    private readonly userVoucherService: UserVoucherService,
  ) {
    this.oauth = new OAuth2Client();
  }

  /**
   * Verify idToken từ frontend, tìm user theo googleId/email hoặc tạo mới.
   * Không dùng password — chỉ tin token Google.
   */
  async signInWithIdToken(
    idToken: string,
    ctx?: GoogleSignInContext,
  ): Promise<User> {
    const profile = await this.verifyIdToken(idToken);
    return this.findOrCreateUser(profile, ctx);
  }

  /** Chỉ xác minh idToken (dùng cho đăng nhập admin — không tạo user). */
  async verifyGoogleIdToken(idToken: string): Promise<GoogleIdTokenProfile> {
    return this.verifyIdToken(idToken);
  }

  private async verifyIdToken(idToken: string): Promise<GoogleIdTokenProfile> {
    if (!idToken || typeof idToken !== 'string' || !idToken.trim()) {
      throw new BadRequestException({
        message: 'Thiếu Google idToken.',
        code: 'GOOGLE_ID_TOKEN_MISSING',
      });
    }

    const audience = this.config.getOrThrow<string>(GOOGLE_AUTH_ENV.CLIENT_ID);

    try {
      const ticket = await this.oauth.verifyIdToken({
        idToken: idToken.trim(),
        audience,
      });
      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedException({
          message: 'Payload Google token rỗng.',
          code: 'GOOGLE_TOKEN_PAYLOAD_EMPTY',
        });
      }

      if (!payload.email) {
        throw new BadRequestException({
          message: 'Tài khoản Google không có email công khai.',
          code: 'GOOGLE_EMAIL_MISSING',
        });
      }

      if (payload.email_verified === false) {
        throw new UnauthorizedException({
          message: 'Email Google chưa được xác minh.',
          code: 'GOOGLE_EMAIL_NOT_VERIFIED',
        });
      }

      if (!payload.sub) {
        throw new UnauthorizedException({
          message: 'Token Google thiếu subject (sub).',
          code: 'GOOGLE_SUB_MISSING',
        });
      }

      return {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name ?? payload.email.split('@')[0] ?? 'User',
        avatar: payload.picture ?? null,
      };
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        throw err;
      }
      const message =
        err instanceof Error ? err.message : 'Không xác minh được Google idToken.';
      throw new UnauthorizedException({
        message: `Google idToken không hợp lệ: ${message}`,
        code: 'GOOGLE_ID_TOKEN_INVALID',
      });
    }
  }

  private async findOrCreateUser(
    profile: GoogleIdTokenProfile,
    ctx?: GoogleSignInContext,
  ): Promise<User> {
    const byGoogle = await this.userService.findByGoogleId(profile.googleId);
    if (byGoogle) {
      return this.userService.updateUser(byGoogle.id, {
        name: profile.name,
        avatar: profile.avatar,
      });
    }

    const byEmail = await this.userService.findByEmail(profile.email);
    if (byEmail) {
      if (byEmail.googleId && byEmail.googleId !== profile.googleId) {
        throw new ConflictException({
          message: 'Email đã gắn với tài khoản Google khác.',
          code: 'GOOGLE_EMAIL_CONFLICT',
        });
      }
      return this.userService.updateUser(byEmail.id, {
        googleId: profile.googleId,
        name: profile.name,
        avatar: profile.avatar,
      });
    }

    return this.createUserFromGoogle(profile, ctx);
  }

  private async createUserFromGoogle(
    profile: GoogleIdTokenProfile,
    ctx?: GoogleSignInContext,
  ): Promise<User> {
    if (ctx?.deviceId) {
      await this.fraudService.assertNewAccountAllowedOnDevice(ctx.deviceId);
    }
    const referralCode = await this.userService.generateUniqueReferralCode();
    let referredBy: string | undefined;
    if (ctx?.refCode) {
      const referrer = await this.userService.findByReferralCode(ctx.refCode.toUpperCase());
      if (referrer) referredBy = ctx.refCode.toUpperCase();
    }
    const user = await this.userService.createUser({
      email: profile.email,
      name: profile.name,
      avatar: profile.avatar,
      googleId: profile.googleId,
      referralCode,
      referredBy,
      registrationIp: ctx?.ipAddress,
      registrationDeviceId: ctx?.deviceId,
    });
    try {
      await this.userVoucherService.grantWelcomeVoucher(user.id);
    } catch (e) {
      console.error('[WelcomeVoucher]', e);
    }
    return user;
  }
}
