/** Admin từ API (đăng nhập bằng số điện thoại). */
export type AdminUser = {
  id: string;
  phone: string;
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
