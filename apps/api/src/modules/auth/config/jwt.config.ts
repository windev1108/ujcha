import { ConfigService } from '@nestjs/config';
import type { JwtModuleOptions } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';

/** Tên biến môi trường — dùng chung cho JwtModule, JwtStrategy, JwtTokensService */
export const JWT_ENV = {
  ACCESS_SECRET: 'JWT_ACCESS_SECRET',
  REFRESH_SECRET: 'JWT_REFRESH_SECRET',
  /** Chuỗi `expiresIn` của jsonwebtoken, ví dụ `15m`, `7d` */
  ACCESS_EXPIRES: 'JWT_ACCESS_EXPIRES',
  REFRESH_EXPIRES: 'JWT_REFRESH_EXPIRES',
} as const;

export const JWT_DEFAULTS = {
  ACCESS_EXPIRES: '15m',
  REFRESH_EXPIRES: '7d',
} as const;

/** Đăng ký JwtModule mặc định cho access token (HS256, `sub` = userId) */
export function createJwtAccessOptions(config: ConfigService): JwtModuleOptions {
  return {
    secret: config.getOrThrow<string>(JWT_ENV.ACCESS_SECRET),
    signOptions: {
      expiresIn: (config.get<string>(JWT_ENV.ACCESS_EXPIRES) ?? JWT_DEFAULTS.ACCESS_EXPIRES) as
        SignOptions['expiresIn'],
    },
  };
}
