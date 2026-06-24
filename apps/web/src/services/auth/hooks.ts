"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useRouter } from "@/i18n/navigation";
import { useAuthStore } from "@/store/auth-store";

import { getMe, postSendOtp, postRegister, postLogin, postResetPassword, postGoogleAuth } from "./api";
import { authKeys } from "./keys";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { clearStoredRefCode, getStoredRefCode } from "@/components/common/RefCodeCapture";

export function useMeQuery() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthStore((s) => s.hydrated);

  return useQuery({
    queryKey: authKeys.me,
    queryFn: async () => {
      const res = await getMe();
      useAuthStore.setState({ user: res.user });
      return res;
    },
    enabled: hydrated && !!accessToken,
    staleTime: 60_000,
  });
}

export function useSendOtpMutation(purpose?: 'register' | 'reset') {
  return useMutation({
    mutationFn: (phone: string) => postSendOtp({ phone, purpose }),
  });
}

export function useRegisterMutation() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: async (params: {
      phone: string;
      name: string;
      password: string;
      code: string;
    }) => {
      const deviceId = getOrCreateDeviceId();
      const refCode = getStoredRefCode() ?? undefined;
      return postRegister({ ...params, deviceId, refCode });
    },
    onSuccess: (data) => {
      clearStoredRefCode();
      setSession({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      queryClient.setQueryData(authKeys.me, { user: data.user });
      router.push("/");
    },
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: async (params: { phone: string; password: string }) => {
      const deviceId = getOrCreateDeviceId();
      return postLogin({ ...params, deviceId });
    },
    onSuccess: (data) => {
      setSession({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      queryClient.setQueryData(authKeys.me, { user: data.user });
      const pendingToken = sessionStorage.getItem("pendingGroupOrderJoin");
      if (pendingToken) {
        sessionStorage.removeItem("pendingGroupOrderJoin");
        router.push(`/group-order/${pendingToken}`);
      } else {
        router.push("/");
      }
    },
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: (params: { phone: string; code: string; newPassword: string }) =>
      postResetPassword(params),
  });
}

export function useGoogleAuthMutation() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: async (idToken: string) => {
      const deviceId = getOrCreateDeviceId();
      const refCode = getStoredRefCode() ?? undefined;
      return postGoogleAuth({ idToken, deviceId, refCode });
    },
    onSuccess: (data) => {
      clearStoredRefCode();
      setSession({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      queryClient.setQueryData(authKeys.me, { user: data.user });
      const pendingToken = sessionStorage.getItem("pendingGroupOrderJoin");
      if (pendingToken) {
        sessionStorage.removeItem("pendingGroupOrderJoin");
        router.push(`/group-order/${pendingToken}`);
      } else {
        router.push("/");
      }
    },
  });
}
