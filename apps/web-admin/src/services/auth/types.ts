/** Admin từ API (đăng nhập Google). */
export type AdminUser = {
  id: string;
  email: string;
  role: "super_admin" | "staff";
  name?: string | null;
  permissions: string[];
};

export type AdminAuthResponse = {
  admin: AdminUser;
  accessToken: string;
  refreshToken: string;
};

export type AdminRefreshResponse = {
  accessToken: string;
  refreshToken: string;
  admin: AdminUser;
};
