import { routing } from "../../i18n/routing";
import { Metadata } from "next";
import { AppProviders } from "@/components/providers/app-providers";
import MainLayout from "@/components/layout/MainLayout";
import { fontSans, fontSerif } from "@/assets/font";
import { NextIntlClientProvider } from "next-intl";
import "@/app/globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ujcha.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "UjCha — Enjoy matcha your way.",
    template: "%s | UjCha",
  },
  description: "Khám phá matcha ceremonial grade, cà phê, trà thủ công và đồ uống theo mùa tại UjCha. Nguồn gốc bền vững, chất lượng cao.",
  keywords: ["matcha", "đồ uống thủ công", "cà phê", "trà", "UjCha", "matcha Việt Nam", "ceremonial matcha"],
  authors: [{ name: "UjCha" }],
  creator: "UjCha",
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: SITE_URL,
    siteName: "UjCha",
    title: "UjCha — Enjoy matcha your way.",
    description: "Matcha ceremonial grade, cà phê và đồ uống thủ công tại UjCha. Nguồn gốc bền vững, chất lượng cao.",
  },
  twitter: {
    card: "summary_large_image",
    title: "UjCha — Enjoy matcha your way.",
    description: "Matcha ceremonial grade, cà phê và đồ uống thủ công tại UjCha.",
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: [{ url: "/favicon.png", sizes: "180x180", type: "image/png" }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params
  return (
    <html lang={locale}>
      <body
        suppressHydrationWarning
        className={`${fontSans.variable} ${fontSerif.variable} h-full antialiased`}
        data-testid='app-body'
      >
        {/* Critical: CSS custom properties needed for layout */}
        {/* <RealViewport /> */}
        <div data-testid='app-container' className='flex min-h-screen flex-col'>
          <NextIntlClientProvider>
            <AppProviders>
              <MainLayout>
                {children}
              </MainLayout>
            </AppProviders>
          </NextIntlClientProvider>
        </div>
      </body>
    </html>
  );
}
