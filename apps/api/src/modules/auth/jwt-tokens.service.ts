import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import { JWT_DEFAULTS, JWT_ENV } from './config/jwt.config';

@Injectable()
export class JwtTokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  generateAccessToken(userId: string): Promise<string> {
    return this.jwt.signAsync({ sub: userId });
  }

  generateRefreshToken(userId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId },
      {
        secret: this.config.getOrThrow<string>(JWT_ENV.REFRESH_SECRET),
        expiresIn: (this.config.get<string>(JWT_ENV.REFRESH_EXPIRES) ??
          JWT_DEFAULTS.REFRESH_EXPIRES) as SignOptions['expiresIn'],
      },
    );
  }
}
