"use client";

import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";

import { env } from "@/config/env";
import { useAdminGoogleAuthMutation } from "@/services/auth/hooks";

export function GoogleSignInButton() {
  const mutation = useAdminGoogleAuthMutation();

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

  const webUrl = process.env.NEXT_PUBLIC_WEB_URL ?? "https://kun.vn";

  return (
    <div className="flex w-full flex-col items-stretch gap-2">
      <div className="flex min-h-12 w-full justify-center [&>div]:w-full [&>div]:justify-center max-w-full">
        <GoogleLogin
          onSuccess={onSuccess}
          onError={() => {
            mutation.reset();
          }}
          useOneTap={false}
          theme="outline"
          size="large"
          text="continue_with"
          shape="pill"
          containerProps={{ style: { width: '100%', display: 'flex' } }}
        />
      </div>
      {mutation.isPending ? (
        <p className="text-center text-xs text-zinc-500">Đang đăng nhập…</p>
      ) : null}
      {mutation.isError ? (
        <p className="text-center text-xs text-red-600">
          Đăng nhập thất bại. Email Google phải đã được thêm vào danh sách admin,
          hoặc kiểm tra API / CORS.
        </p>
      ) : null}
      <p className="text-center text-[11px] text-zinc-400">
        Bằng cách đăng nhập, bạn đồng ý với{" "}
        <a href={`${webUrl}/terms`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-zinc-600 transition-colors">
          Điều khoản
        </a>{" "}
        và{" "}
        <a href={`${webUrl}/privacy`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-zinc-600 transition-colors">
          Chính sách bảo mật
        </a>
        {" "}của UjCha.
      </p>
    </div>
  );
}
