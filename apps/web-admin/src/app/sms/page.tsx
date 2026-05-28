import type { Metadata } from "next";
import { SmsClient } from "./components/SmsClient";

export const metadata: Metadata = {
  title: "Nhật ký SMS — UjCha Admin",
  description: "Theo dõi lịch sử gửi SMS OTP qua TextBee.",
};

export default function SmsPage() {
  return <SmsClient />;
}
