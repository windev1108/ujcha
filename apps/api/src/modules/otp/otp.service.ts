import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { FraudService } from '../fraud/fraud.service';
import { OTP_DEFAULTS, OTP_ENV } from './config/otp.config';
import { PrismaService } from '../prisma/prisma.service';

export type GenerateOtpResult = {
  /** Mã gửi SMS / hiển thị; không lưu plaintext trong DB */
  code: string;
  expiresAt: Date;
};

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly fraudService: FraudService,
  ) {}

  async generateOtp(phone: string, requestIp: string): Promise<GenerateOtpResult> {
    await this.fraudService.assertOtpSendAllowed(phone, requestIp);

    const code = this.randomNumericOtp();
    const hashed = await bcrypt.hash(code, this.getBcryptSaltRounds());
    const expiresAt = new Date(Date.now() + this.getOtpExpiryMs());

    await this.prisma.otp.create({
      data: {
        phone,
        code: hashed,
        expiresAt,
        requestIp: requestIp || null,
      },
    });

    return { code, expiresAt };
  }

  async verifyOtp(phone: string, code: string): Promise<void> {
    const otp = await this.prisma.otp.findFirst({
      where: {
        phone,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new NotFoundException({
        message: 'Không có mã OTP hợp lệ cho số điện thoại này (hết hạn hoặc đã dùng).',
        code: 'OTP_NOT_FOUND_OR_INACTIVE',
      });
    }

    const matches = await bcrypt.compare(code, otp.code);
    if (!matches) {
      throw new UnauthorizedException({
        message: 'Mã OTP không đúng.',
        code: 'OTP_INVALID',
      });
    }

    await this.prisma.otp.update({
      where: { id: otp.id },
      data: { isUsed: true },
    });
  }

  private getOtpExpiryMs(): number {
    const raw = this.config.get<string>(OTP_ENV.EXPIRES_MINUTES);
    const minutes = raw !== undefined ? Number(raw) : OTP_DEFAULTS.EXPIRES_MINUTES;
    const m = Number.isFinite(minutes) && minutes > 0 ? minutes : OTP_DEFAULTS.EXPIRES_MINUTES;
    return m * 60 * 1000;
  }

  private getBcryptSaltRounds(): number {
    const raw = this.config.get<string>(OTP_ENV.BCRYPT_SALT_ROUNDS);
    const n = raw !== undefined ? Number(raw) : OTP_DEFAULTS.BCRYPT_SALT_ROUNDS;
    if (!Number.isFinite(n)) return OTP_DEFAULTS.BCRYPT_SALT_ROUNDS;
    const rounded = Math.floor(n);
    if (rounded < 8 || rounded > 15) return OTP_DEFAULTS.BCRYPT_SALT_ROUNDS;
    return rounded;
  }

  private randomNumericOtp(): string {
    let out = '';
    for (let i = 0; i < 6; i++) {
      out += String(Math.floor(Math.random() * 10));
    }
    return out;
  }
}
