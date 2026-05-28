import { api } from "@/config/server";
import type { AuthTokensResponse } from "./types";

export async function postSendOtp(body: { phone: string }): Promise<void> {
  await api.post("/auth/send-otp", body);
}

export async function postRegister(body: {
  phone: string;
  name: string;
  password: string;
  code: string;
  deviceId: string;
  refCode?: string;
}): Promise<AuthTokensResponse> {
  const { data } = await api.post<AuthTokensResponse>("/auth/register", body);
  return data;
}

export async function postLogin(body: {
  phone: string;
  password: string;
  deviceId: string;
}): Promise<AuthTokensResponse> {
  const { data } = await api.post<AuthTokensResponse>("/auth/login", body);
  return data;
}

export async function postResetPassword(body: {
  phone: string;
  code: string;
  newPassword: string;
}): Promise<void> {
  await api.post("/auth/reset-password", body);
}

export async function postGoogleAuth(body: {
  idToken: string;
  deviceId: string;
  refCode?: string;
}): Promise<AuthTokensResponse> {
  const { data } = await api.post<AuthTokensResponse>("/auth/google", body);
  return data;
}

export async function getMe(): Promise<{ user: AuthTokensResponse["user"] }> {
  const { data } = await api.get<{ user: AuthTokensResponse["user"] }>("/auth/me");
  return data;
}
