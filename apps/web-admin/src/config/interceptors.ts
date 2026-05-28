import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";

import { useAuthStore } from "@/store/auth-store";

import { server } from "./server";

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

const redirectToLogin = () => {
  useAuthStore.getState().clearSession();
  if (typeof window !== "undefined") {
    document.location.href = "/login";
  }
};

export const requestInterceptor = (config: InternalAxiosRequestConfig) => {
  if (typeof window !== "undefined") {
    const { accessToken } = useAuthStore.getState();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
  }
  return config;
};

export const successInterceptor = (response: AxiosResponse) => {
  const data = response.data;
  const { setTokens } = useAuthStore.getState();

  if (data?.accessToken && data?.refreshToken) {
    setTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
  }
  return response;
};

export const errorInterceptor = async (error: AxiosError) => {
  const originalRequest = error.config as InternalAxiosRequestConfig & {
    _retry?: boolean;
  };

  const url = originalRequest?.url ?? "";
  const isRefreshCall = url.includes("/admin/auth/refresh");

  // Nếu là refresh call mà vẫn 401 → token hết hạn hoàn toàn → đá về login
  if (error.response?.status === 401 && isRefreshCall) {
    redirectToLogin();
    return Promise.reject(error);
  }

  if (
    error.response?.status === 401 &&
    originalRequest &&
    !originalRequest._retry &&
    !isRefreshCall &&
    typeof window !== "undefined"
  ) {
    const { refreshToken } = useAuthStore.getState();

    // Không có refresh token → đá về login luôn
    if (!refreshToken) {
      redirectToLogin();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(() => server.request(originalRequest!))
        .catch((err: unknown) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { postAdminRefresh } = await import("@/services/auth/api");
      const res = await postAdminRefresh(refreshToken);

      useAuthStore.getState().setTokens({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      });
      useAuthStore.setState({ admin: res.admin });

      processQueue(null);
      isRefreshing = false;

      return server.request(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError as Error);
      isRefreshing = false;
      redirectToLogin();
      return Promise.reject(refreshError);
    }
  }

  return Promise.reject(error);
};