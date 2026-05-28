import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

import { env } from "@/config/env";
import { useAuthStore } from "@/store/auth-store";
import { RefreshResponse } from "@/services/auth/types";

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
            useAuthStore.getState().clearSession();
            return Promise.reject(error);
        }

        original._retry = true;

        try {
            const { data } = await axios.post<RefreshResponse>(
                `${baseURL}/auth/refresh`,
                { refreshToken },
            );
            useAuthStore.getState().setAccessToken(data.accessToken);
            original.headers.Authorization = `Bearer ${data.accessToken}`;
            return api(original);
        } catch {
            useAuthStore.getState().clearSession();
            return Promise.reject(error);
        }
    },
);