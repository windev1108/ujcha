import { routing } from "../../i18n/routing";
import { Metadata } from "next";
import { AppProviders } from "@/components/providers/app-providers";
import MainLayout from "@/components/layout/MainLayout";
import { fontSans, fontSerif } from "@/assets/font";
import { NextIntlClientProvider } from "next-intl";
import "@/app/globals.css";

const _rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ujcha.vercel.app";
const SITE_URL = _rawSiteUrl.startsWith("http") ? _rawSiteUrl : `https://${_rawSiteUrl}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "UjCha — Matcha & More",
    template: "%s | UjCha",
  },
  description: "Khám phá matcha ceremonial grade, cà phê, trà thủ công và đồ uống theo mùa tại UjCha. Nguồn gốc bền vững, chất lượng cao.",
  keywords: [
    "matcha", "UjCha", "matcha Việt Nam", "ceremonial matcha", "đồ uống thủ công",
    "cà phê Đà Nẵng", "trà matcha", "matcha Đà Nẵng", "đặt đồ uống online",
    "giao đồ uống Đà Nẵng", "café matcha", "trà thủ công", "ujcha.vn",
  ],
  authors: [{ name: "UjCha" }],
  creator: "UjCha",
  publisher: "UjCha",
  alternates: {
    canonical: SITE_URL,
    languages: {
      vi: `${SITE_URL}/vi`,
      en: `${SITE_URL}/en`,
      "x-default": `${SITE_URL}/vi`,
    },
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    alternateLocale: "en_US",
    url: SITE_URL,
    siteName: "UjCha",
    title: "UjCha — Matcha & More",
    description: "Matcha ceremonial grade, cà phê và đồ uống thủ công tại UjCha. Nguồn gốc bền vững, chất lượng cao.",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "UjCha — Matcha ceremonial grade & đồ uống thủ công",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "UjCha — Matcha & More",
    description: "Matcha ceremonial grade, cà phê và đồ uống thủ công tại UjCha.",
    images: ["/api/og"],
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: [{ url: "/favicon.png", sizes: "180x180", type: "image/png" }],
  },
  verification: {
    google: "tbMo0FeyASrcrFwsGU7gC8LupFpfeXZnku2QcIM3h-A",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
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
      <head>
        {/* Anton display font */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&display=swap"
          rel="stylesheet"
        />
      </head>
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
