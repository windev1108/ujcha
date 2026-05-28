import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AdminJwtUser } from '../admin-jwt.types';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminJwtUser => {
    const req = ctx.switchToHttp().getRequest<{ user: AdminJwtUser }>();
    return req.user;
  },
);
