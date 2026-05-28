"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/store/auth-store";

import { getAdminMe, postAdminGoogleLogin } from "./api";
import { authKeys } from "./keys";

export function useAdminMeQuery() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthStore((s) => s.hydrated);

  return useQuery({
    queryKey: authKeys.me,
    queryFn: async () => {
      const res = await getAdminMe();
      useAuthStore.setState({ admin: res.admin });
      return res;
    },
    enabled: hydrated && !!accessToken,
    staleTime: 60_000,
  });
}

export function useAdminGoogleAuthMutation() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: async (idToken: string) => postAdminGoogleLogin({ idToken }),
    onSuccess: (data) => {
      setSession({
        admin: data.admin,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      queryClient.setQueryData(authKeys.me, { admin: data.admin });
      router.push("/");
    },
  });
}
