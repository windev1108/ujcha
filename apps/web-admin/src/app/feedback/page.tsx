import type { Metadata } from "next";
import { FeedbackClient } from "./components/FeedbackClient";

export const metadata: Metadata = {
  title: "Phản hồi khách hàng — UjCha Admin",
  description: "Xem và quản lý phản hồi từ khách hàng.",
};

export default function FeedbackPage() {
  return <FeedbackClient />;
}
