import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { errorInterceptor, requestInterceptor, successInterceptor } from './interceptors';
import { env } from './env';

const axiosRequestConfig: AxiosRequestConfig = {
  baseURL: env.API_URL ?? "http://localhost:5000",
  headers: {
    "Content-Type": "application/json",
  },
  /** Bearer access token (interceptors); refresh qua POST /admin/auth/refresh, không dùng cookie. */
};

export const server: AxiosInstance = axios.create(axiosRequestConfig);

/** Alias — các module admin dùng tên `api`. */
export const api = server;

server.interceptors.request.use(requestInterceptor);
server.interceptors.response.use(successInterceptor, errorInterceptor);
