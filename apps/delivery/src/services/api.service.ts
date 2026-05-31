import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '@/constants/api';
import { useAuthStore } from '@/store/auth.store';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

apiClient.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status !== 401 || original._retry) throw error;

    original._retry = true;

    if (!refreshPromise) {
      refreshPromise = (async () => {
        const { refreshToken, setTokens, clearAuth } = useAuthStore.getState();
        if (!refreshToken) { await clearAuth(); return null; }
        try {
          const { data } = await axios.post<{
            accessToken: string;
            refreshToken: string;
            shipper: { id: string; name: string; phone: string | null };
          }>(`${API_BASE_URL}/shipper-auth/refresh`, { refreshToken });
          await setTokens(data.accessToken, data.refreshToken, data.shipper);
          return data.accessToken;
        } catch {
          await clearAuth();
          return null;
        } finally {
          refreshPromise = null;
        }
      })();
    }

    const newToken = await refreshPromise;
    if (!newToken) throw error;

    original.headers.Authorization = `Bearer ${newToken}`;
    return apiClient(original);
  },
);

export const shipperApi = {
  login: (phone: string, password: string) =>
    apiClient.post<{
      accessToken: string;
      refreshToken: string;
      shipper: { id: string; name: string; phone: string | null };
    }>('/shipper-auth/login', { phone, password }),

  getMe: () =>
    apiClient.get<{ id: string; name: string; phone: string | null; imageUrl: string | null }>(
      '/shipper-auth/me',
    ),
  updatePhone: (phone: string) =>
    apiClient.patch<{ phone: string | null }>('/shipper-auth/phone', { phone }),

  getOrders: () => apiClient.get('/shipper/orders'),
  getAvailableOrders: () => apiClient.get('/shipper/orders/available'),
  getOrderHistory: () => apiClient.get('/shipper/orders/history'),
  getOrder: (id: string) => apiClient.get(`/shipper/orders/${id}`),
  acceptOrder: (id: string) => apiClient.patch(`/shipper/orders/${id}/accept`),
  markPickedUp: (id: string) => apiClient.patch(`/shipper/orders/${id}/pickup`),
  markArrived: (id: string) => apiClient.patch(`/shipper/orders/${id}/arrived`),
  completeDelivery: (id: string) => apiClient.patch(`/shipper/orders/${id}/complete`),

  postLocation: (orderId: string, lat: number, lng: number, timestamp: number) =>
    apiClient.post('/tracking/location', { orderId, lat, lng, timestamp }),
};
