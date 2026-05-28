import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AdminRole } from '@prisma/client';
import { ADMIN_ROLES_KEY } from '../decorators/roles.decorator';
import type { AdminJwtUser } from '../admin-jwt.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AdminRole[] | undefined>(
      ADMIN_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{ user?: AdminJwtUser }>();
    const admin = req.user;
    if (!admin?.role) {
      throw new ForbiddenException({
        message: 'Không xác định được quyền admin.',
        code: 'ADMIN_FORBIDDEN',
      });
    }

    if (!required.includes(admin.role)) {
      throw new ForbiddenException({
        message: 'Không đủ quyền truy cập.',
        code: 'ADMIN_FORBIDDEN',
      });
    }

    return true;
  }
}
