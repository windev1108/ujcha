import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginPageShell } from "./components/LoginPageShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t("login"),
    description: "Đăng nhập bằng số điện thoại để tiếp tục trải nghiệm UjCha.",
  };
}

export default function DangNhapPage() {
  return <LoginPageShell />;
}
