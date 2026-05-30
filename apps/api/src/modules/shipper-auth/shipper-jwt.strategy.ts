import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SHIPPER_JWT_ENV } from './config/shipper-jwt.config';
import { SHIPPER_JWT_TYPE, type ShipperJwtPayload, type ShipperJwtUser } from './shipper-jwt.types';

@Injectable()
export class ShipperJwtStrategy extends PassportStrategy(Strategy, 'shipper-jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>(SHIPPER_JWT_ENV.ACCESS_SECRET),
    });
  }

  validate(payload: ShipperJwtPayload): ShipperJwtUser {
    if (payload.typ !== SHIPPER_JWT_TYPE) {
      throw new UnauthorizedException({ message: 'Token không hợp lệ.', code: 'SHIPPER_TOKEN_INVALID' });
    }
    return { adminId: payload.sub, shipperId: payload.shipperId };
  }
}
