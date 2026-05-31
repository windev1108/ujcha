import axios from "axios";

import { env } from "@/config/env";
import { server } from "@/config/server";
import type { AdminAuthResponse, AdminRefreshResponse, AdminUser } from "./types";

export async function postAdminPhoneLogin(body: {
  phone: string;
  password: string;
}): Promise<AdminAuthResponse> {
  const { data } = await server.post<AdminAuthResponse>("/admin/auth/phone", body);
  return data;
}

/** Gọi trực tiếp (không qua interceptors) để tránh vòng lặp refresh. */
export async function postAdminRefresh(refreshToken: string): Promise<AdminRefreshResponse> {
  const { data } = await axios.post<AdminRefreshResponse>(
    `${env.API_URL}/admin/auth/refresh`,
    { refreshToken },
    { headers: { "Content-Type": "application/json" } },
  );
  return data;
}

export async function getAdminMe(): Promise<{ admin: AdminUser }> {
  const { data } = await server.get<{ admin: AdminUser }>("/admin/auth/me");
  return data;
}
