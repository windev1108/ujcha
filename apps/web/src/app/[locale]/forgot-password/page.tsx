import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ForgotPasswordPageShell } from "./components/ForgotPasswordPageShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t("forgot_password_title"),
    description: "Đặt lại mật khẩu qua số điện thoại.",
  };
}

export default function QuenMatKhauPage() {
  return <ForgotPasswordPageShell />;
}
