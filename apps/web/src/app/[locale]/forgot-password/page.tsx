import type { Metadata } from "next";
import { ForgotPasswordPageShell } from "./components/ForgotPasswordPageShell";

export const metadata: Metadata = {
  title: "Quên mật khẩu",
  description: "Đặt lại mật khẩu qua số điện thoại.",
};

export default function QuenMatKhauPage() {
  return <ForgotPasswordPageShell />;
}
