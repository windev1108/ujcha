import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { shipperApi } from '@/services/api.service';
import { socketService } from '@/services/socket.service';

export function useAuth() {
  const { accessToken, shipper, hydrated, setTokens, clearAuth } = useAuthStore();
  const router = useRouter();

  const login = useCallback(async (phone: string, password: string) => {
    const { data } = await shipperApi.login(phone, password);
    await setTokens(data.accessToken, data.refreshToken, data.shipper);
    socketService.connect();
    router.replace('/(shipper)/');
  }, [setTokens, router]);

  const logout = useCallback(async () => {
    socketService.disconnect();
    await clearAuth();
  }, [clearAuth]);

  return {
    isAuthenticated: !!accessToken && !!shipper,
    shipper,
    hydrated,
    login,
    logout,
  };
}
