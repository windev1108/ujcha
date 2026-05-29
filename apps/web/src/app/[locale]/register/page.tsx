import type { Metadata } from "next";
import { RegisterPageShell } from "./components/RegisterPageShell";

export const metadata: Metadata = {
  title: "Đăng ký",
  description: "Tạo tài khoản UjCha và bắt đầu trải nghiệm ẩm thực tỉnh thức.",
};

export default function DangKyPage() {
  return <RegisterPageShell />;
}
