import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtValidatedUser } from '../jwt.strategy';

/** `sessionId` từ JWT access token (sau JwtAuthGuard). */
export const CurrentSessionId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<{ user: JwtValidatedUser }>();
    return req.user.sessionId;
  },
);
