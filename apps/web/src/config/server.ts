import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

import { env } from "@/config/env";
import { useAuthStore } from "@/store/auth-store";
import { RefreshResponse } from "@/services/auth/types";
import { ROUTES } from "@/lib/routes";

const baseURL = env.API_URL.replace(/\/$/, "");

export const api = axios.create({
    baseURL,
    headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Gom các request 401 xảy ra đồng thời lại thành 1 lần gọi /auth/refresh duy nhất,
// tránh việc refresh token bị rotate mất hiệu lực giữa các request song song.
let isRefreshing = false;
let refreshWaiters: Array<(token: string) => void> = [];
let refreshError: unknown = null;

function subscribeTokenRefresh(cb: (token: string) => void) {
    refreshWaiters.push(cb);
}

function onRefreshed(token: string) {
    refreshWaiters.forEach((cb) => cb(token));
    refreshWaiters = [];
}

function onRefreshFailed(err: unknown) {
    refreshError = err;
    refreshWaiters = [];
}

const LOGIN_PATH = ROUTES.LOGIN;

function redirectToLogin() {
    useAuthStore.getState().clearSession();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith(LOGIN_PATH)) {
        const redirectParam = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `${LOGIN_PATH}?redirect=${redirectParam}`;
    }
}

api.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
        const original = error.config as InternalAxiosRequestConfig & {
            _retry?: boolean;
        };
        const status = error.response?.status;

        if (
            status !== 401 ||
            original?._retry ||
            original?.url?.includes("/auth/refresh")
        ) {
            return Promise.reject(error);
        }

        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) {
            redirectToLogin();
            return Promise.reject(error);
        }

        original._retry = true;

        // Nếu đang có 1 lần refresh khác chạy → đợi kết quả thay vì gọi thêm lần refresh mới
        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                subscribeTokenRefresh((newAccessToken: string) => {
                    original.headers.Authorization = `Bearer ${newAccessToken}`;
                    resolve(api(original));
                });
                // Nếu refresh đang chạy fail, reject theo lỗi gốc (redirect đã xử lý ở nhánh catch chính)
                const checkFailure = setInterval(() => {
                    if (refreshError) {
                        clearInterval(checkFailure);
                        reject(error);
                    }
                }, 50);
            });
        }

        isRefreshing = true;
        refreshError = null;

        try {
            const { data } = await axios.post<RefreshResponse>(
                `${baseURL}/auth/refresh`,
                { refreshToken },
            );
            useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);
            original.headers.Authorization = `Bearer ${data.accessToken}`;
            onRefreshed(data.accessToken);
            return api(original);
        } catch (refreshErr) {
            onRefreshFailed(refreshErr);
            // Refresh token hết hạn/không hợp lệ/bị thu hồi — đều không thể tự phục hồi,
            // bắt buộc đăng nhập lại.
            redirectToLogin();
            return Promise.reject(error);
        } finally {
            isRefreshing = false;
        }
    },
);