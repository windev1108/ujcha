import type { Metadata } from "next";
import { CartPageShell } from "./components/CartPageShell";

export const metadata: Metadata = {
  title: "Giỏ hàng",
  description:
    "Xem giỏ hàng của bạn — matcha, dụng cụ và những món đã chọn cho ritual hàng ngày.",
};

export default function CartPage() {
  return <CartPageShell />;
}
