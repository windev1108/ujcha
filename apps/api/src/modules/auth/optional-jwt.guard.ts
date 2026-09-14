import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { JwtValidatedUser } from './jwt.strategy';

/**
 * JWT tuỳ chọn:
 * - Không có token → guest (user = null), không throw.
 * - Có token nhưng hết hạn/không hợp lệ → throw 401 để client tự refresh.
 * - Token hợp lệ → gắn req.user = { userId, sessionId }.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const hasToken = !!(request.headers['authorization'] as string | undefined);
    try {
      await super.canActivate(context);
    } catch (err) {
      if (hasToken) {
        throw new UnauthorizedException('Token invalid or expired');
      }
    }
    return true;
  }

  handleRequest<T = JwtValidatedUser | null>(_err: Error | null, user: T): T {
    if (!user) return null as T;
    return user;
  }
}
