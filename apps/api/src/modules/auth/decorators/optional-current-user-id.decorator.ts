import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtValidatedUser } from '../jwt.strategy';

/** `userId` từ JWT nếu có; `null` nếu guest (sau OptionalJwtAuthGuard). */
export const OptionalCurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const req = ctx.switchToHttp().getRequest<{ user?: JwtValidatedUser }>();
    return req.user?.userId ?? null;
  },
);
