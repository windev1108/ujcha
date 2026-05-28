import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtValidatedUser } from '../jwt.strategy';

/** `userId` từ JWT (sau JwtAuthGuard). */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<{ user: JwtValidatedUser }>();
    return req.user.userId;
  },
);
