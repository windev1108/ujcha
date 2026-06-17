import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { JwtValidatedUser } from './jwt.strategy';

/**
 * JWT tuỳ chọn — không throw khi thiếu/hết hạn token.
 * Gắn `req.user = null` cho guest; gắn `req.user = { userId }` khi token hợp lệ.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      // No token / expired token — continue as guest
    }
    return true;
  }

  handleRequest<T = JwtValidatedUser>(_err: Error | null, user: T): T {
    if (!user) return null as T;
    return user;
  }
}
