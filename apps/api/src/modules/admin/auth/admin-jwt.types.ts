import type { AdminRole } from '@prisma/client';

export const ADMIN_JWT_TYPE = 'admin' as const;
export const ADMIN_JWT_REFRESH_TYPE = 'admin_refresh' as const;

export type AdminJwtPayload = {
  sub: string;
  role: AdminRole;
  typ: typeof ADMIN_JWT_TYPE;
  permissions: string[];
};

export type AdminRefreshJwtPayload = {
  sub: string;
  role: AdminRole;
  typ: typeof ADMIN_JWT_REFRESH_TYPE;
};

export type AdminJwtUser = {
  adminId: string;
  role: AdminRole;
  permissions: string[];
};
