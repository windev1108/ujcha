import { ConfigService } from '@nestjs/config';
import type { JwtModuleOptions } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';

export const ADMIN_JWT_ENV = {
  ACCESS_SECRET: 'ADMIN_JWT_ACCESS_SECRET',
  ACCESS_EXPIRES: 'ADMIN_JWT_ACCESS_EXPIRES',
  REFRESH_SECRET: 'ADMIN_JWT_REFRESH_SECRET',
  REFRESH_EXPIRES: 'ADMIN_JWT_REFRESH_EXPIRES',
} as const;

export const ADMIN_JWT_DEFAULTS = {
  ACCESS_EXPIRES: '1d',
  REFRESH_EXPIRES: '7d',
} as const;

export function createAdminJwtOptions(config: ConfigService): JwtModuleOptions {
  return {
    secret: config.getOrThrow<string>(ADMIN_JWT_ENV.ACCESS_SECRET),
    signOptions: {
      expiresIn: (config.get<string>(ADMIN_JWT_ENV.ACCESS_EXPIRES) ??
        ADMIN_JWT_DEFAULTS.ACCESS_EXPIRES) as SignOptions['expiresIn'],
    },
  };
}
