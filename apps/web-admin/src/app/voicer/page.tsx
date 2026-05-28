import type { Metadata } from "next";
import { VoicerClient } from "./components/VoicerClient";

export const metadata: Metadata = {
  title: "Cấu hình giọng đọc — UjCha Admin",
  description: "Thiết lập giọng đọc Viettel AI TTS cho thông báo thanh toán.",
};

export default function VoicerPage() {
  return <VoicerClient />;
}
