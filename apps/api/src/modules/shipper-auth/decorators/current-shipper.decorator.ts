import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { ShipperJwtUser } from '../shipper-jwt.types';

export const CurrentShipper = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ShipperJwtUser => {
    const req = ctx.switchToHttp().getRequest<{ user: ShipperJwtUser }>();
    return req.user;
  },
);
