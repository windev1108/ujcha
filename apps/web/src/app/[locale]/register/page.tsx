import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RegisterPageShell } from "./components/RegisterPageShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t("create_account"),
    description: "Tạo tài khoản UjCha và bắt đầu trải nghiệm ẩm thực tỉnh thức.",
  };
}

export default function DangKyPage() {
  return <RegisterPageShell />;
}
