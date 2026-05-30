import { ConfigService } from '@nestjs/config';
import type { JwtModuleOptions } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';

export const SHIPPER_JWT_ENV = {
  ACCESS_SECRET: 'SHIPPER_JWT_ACCESS_SECRET',
  ACCESS_EXPIRES: 'SHIPPER_JWT_ACCESS_EXPIRES',
  REFRESH_SECRET: 'SHIPPER_JWT_REFRESH_SECRET',
  REFRESH_EXPIRES: 'SHIPPER_JWT_REFRESH_EXPIRES',
} as const;

export const SHIPPER_JWT_DEFAULTS = {
  ACCESS_EXPIRES: '8h',
  REFRESH_EXPIRES: '30d',
} as const;

export function createShipperJwtOptions(config: ConfigService): JwtModuleOptions {
  return {
    secret: config.getOrThrow<string>(SHIPPER_JWT_ENV.ACCESS_SECRET),
    signOptions: {
      expiresIn: (config.get<string>(SHIPPER_JWT_ENV.ACCESS_EXPIRES) ??
        SHIPPER_JWT_DEFAULTS.ACCESS_EXPIRES) as SignOptions['expiresIn'],
    },
  };
}
