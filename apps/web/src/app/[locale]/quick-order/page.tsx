import type { Metadata } from "next";
import { QuickOrderPageShell } from "./components/QuickOrderPageShell";

export const metadata: Metadata = {
  title: "Đặt món nhanh tại bàn",
  description:
    "Quét và đặt món tại bàn — matcha, cà phê, trà và bánh, thanh toán nhanh chóng.",
};

export default function DatMonNhanhPage() {
  return <QuickOrderPageShell />;
}
