import type { Metadata } from "next";
import { LoginPageShell } from "./components/LoginPageShell";

export const metadata: Metadata = {
  title: "Đăng nhập — UjCha Admin",
  description: "Đăng nhập quản trị bằng Google (tài khoản được cấp quyền).",
};

export default function DangNhapPage() {
  return <LoginPageShell />;
}
