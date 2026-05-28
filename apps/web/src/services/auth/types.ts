/** User trả về từ API (Prisma User, JSON). */
export type AuthUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar: string | null;
  referralCode: string;
  googleId: string | null;
  emailMarketingEnabled: boolean;
};

export type AuthTokensResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export type RefreshResponse = {
  accessToken: string;
};
