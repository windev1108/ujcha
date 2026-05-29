import type { Metadata } from "next";
import { LoginPageShell } from "./components/LoginPageShell";

export const metadata: Metadata = {
  title: "Đăng nhập",
  description: "Đăng nhập bằng số điện thoại để tiếp tục trải nghiệm UjCha.",
};

export default function DangNhapPage() {
  return <LoginPageShell />;
}
