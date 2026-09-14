import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_ENV } from './config/jwt.config';
import type { JwtAccessPayload } from './jwt.types';

/** Giá trị gắn vào `request` sau khi validate */
export type JwtValidatedUser = {
  userId: string;
  sessionId: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>(JWT_ENV.ACCESS_SECRET),
    });
  }

  validate(payload: JwtAccessPayload): JwtValidatedUser {
    if (!payload?.sub || typeof payload.sub !== 'string') {
      throw new UnauthorizedException({
        message: 'Token không hợp lệ: thiếu `sub`.',
        code: 'JWT_INVALID_PAYLOAD',
      });
    }
    if (!payload?.sid || typeof payload.sid !== 'string') {
      throw new UnauthorizedException({
        message: 'Token không hợp lệ: thiếu `sid`.',
        code: 'JWT_INVALID_PAYLOAD',
      });
    }
    return { userId: payload.sub, sessionId: payload.sid };
  }
}
