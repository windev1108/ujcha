import { Metadata } from "next";
import { ChatWidgetConfigClient } from "./components/ChatWidgetConfigClient";

export const metadata: Metadata = {
  title: "Cấu hình Chat Widget — UjCha Admin",
  description: "Xem và quản lý cấu hình Chat Widget",
};

export default function FeedbackPage() {
  return <ChatWidgetConfigClient />;
}
