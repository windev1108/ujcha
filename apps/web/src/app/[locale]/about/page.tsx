import type { Metadata } from "next";
import { AboutShell } from "./components/AboutShell";

export const metadata: Metadata = {
  title: "Về chúng tôi",
  description: "UjCha ra đời từ niềm đam mê với matcha và triết lý pha chế thủ công. Matcha ceremonial grade, nguyên liệu bền vững, chú tâm trong từng ly.",
  openGraph: {
    title: "Về chúng tôi",
    description: "UjCha ra đời từ niềm đam mê với matcha và triết lý pha chế thủ công.",
    url: "/about",
  },
};

export default function AboutPage() {
  return <AboutShell />;
}
