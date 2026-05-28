import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AdminRole } from '@prisma/client';
import { ADMIN_JWT_ENV } from './config/admin-jwt.config';
import {
  ADMIN_JWT_TYPE,
  type AdminJwtPayload,
  type AdminJwtUser,
} from './admin-jwt.types';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>(ADMIN_JWT_ENV.ACCESS_SECRET),
    });
  }

  validate(payload: AdminJwtPayload): AdminJwtUser {
    if (!payload?.sub || typeof payload.sub !== 'string') {
      throw new UnauthorizedException({
        message: 'Token admin không hợp lệ: thiếu `sub`.',
        code: 'ADMIN_JWT_INVALID_PAYLOAD',
      });
    }
    if (payload.typ !== ADMIN_JWT_TYPE) {
      throw new UnauthorizedException({
        message: 'Token không phải admin.',
        code: 'ADMIN_JWT_WRONG_TYPE',
      });
    }
    if (payload.role !== AdminRole.super_admin && payload.role !== AdminRole.staff) {
      throw new UnauthorizedException({
        message: 'Token admin không hợp lệ: role không hợp lệ.',
        code: 'ADMIN_JWT_INVALID_ROLE',
      });
    }

    return { adminId: payload.sub, role: payload.role, permissions: payload.permissions ?? [] };
  }
}
