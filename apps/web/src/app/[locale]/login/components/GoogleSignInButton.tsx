"use client";

import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";

import { env } from "@/config/env";
import { useGoogleAuthMutation } from "@/services/auth/hooks";

export function GoogleSignInButton() {
  const mutation = useGoogleAuthMutation();

  const onSuccess = (cred: CredentialResponse) => {
    if (cred.credential) {
      mutation.mutate(cred.credential);
    }
  };

  if (!env.GOOGLE_CLIENT_ID) {
    return (
      <p className="rounded-full bg-amber-50 px-4 py-3 text-center text-xs text-amber-900 ring-1 ring-amber-200">
        Thiếu NEXT_PUBLIC_GOOGLE_CLIENT_ID — thêm vào .env (cùng Client ID với API
        GOOGLE_CLIENT_ID).
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-2">
      <div className="flex min-h-12 w-full justify-center [&>div]:w-full [&>div]:justify-center">
        <GoogleLogin
          onSuccess={onSuccess}
          onError={() => {
            mutation.reset();
          }}
          useOneTap={false}
          theme="outline"
          size="large"
          width="320"
          text="continue_with"
          shape="pill"
        />
      </div>
      {mutation.isPending ? (
        <p className="text-center text-xs text-muted">Đang đăng nhập…</p>
      ) : null}
      {mutation.isError ? (
        <p className="text-center text-xs text-red-600">
          Đăng nhập thất bại. Thử lại hoặc kiểm tra API / CORS.
        </p>
      ) : null}
    </div>
  );
}
