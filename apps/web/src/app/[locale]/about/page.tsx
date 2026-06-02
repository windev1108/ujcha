import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AboutShell } from "./components/AboutShell";

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t("about"),
    description: "UjCha ra đời từ niềm đam mê với matcha và triết lý pha chế thủ công. Matcha ceremonial grade, nguyên liệu bền vững, chú tâm trong từng ly.",
    openGraph: {
      title: "Về chúng tôi",
      description: "UjCha ra đời từ niềm đam mê với matcha và triết lý pha chế thủ công.",
      url: "/about",
    },
  };
}

export default function AboutPage() {
  return <AboutShell />;
}
