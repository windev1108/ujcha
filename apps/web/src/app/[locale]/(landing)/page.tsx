import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Categories } from "@/app/[locale]/(landing)/components/Categories";
import { Hero } from "@/app/[locale]/(landing)/components/Hero";
import { ProductGallery } from "@/app/[locale]/(landing)/components/ProductGallery";
import { PromoBanner } from "@/app/[locale]/(landing)/components/PromoBanner";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ujcha.vercel.app";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t("home_page_title"),
    description:
      "Khám phá matcha ceremonial grade, cà phê, trà thủ công và đồ uống theo mùa. Nguồn gốc bền vững — giao hàng tận nơi - khu vực thành phố Đà Nẵng.",
    openGraph: {
      title: "UjCha — Enjoy matcha your way",
      description:
        "Matcha ceremonial grade, cà phê và đồ uống thủ công tại UjCha. Nguồn gốc bền vững, chất lượng cao.",
      url: SITE_URL,
      images: [
        {
          url: "/api/og",
          width: 1200,
          height: 630,
          alt: "UjCha — Matcha ceremonial grade & đồ uống thủ công",
        },
      ],
    },
  };
}

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "UjCha",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
        width: 512,
        height: 512,
      },
      description:
        "UjCha là nền tảng đặt đồ uống matcha ceremonial grade, cà phê và trà thủ công tại Đà Nẵng, Việt Nam.",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Đà Nẵng",
        addressCountry: "VN",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "UjCha",
      description: "Marketplace đồ uống matcha, cà phê, trà thủ công tại Đà Nẵng",
      publisher: { "@id": `${SITE_URL}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/menu?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
      inLanguage: ["vi", "en"],
    },
    {
      "@type": "FoodEstablishment",
      "@id": `${SITE_URL}/#restaurant`,
      name: "UjCha",
      description:
        "Matcha ceremonial grade, cà phê và đồ uống thủ công. Nguồn gốc bền vững, giao hàng tận nơi tại Đà Nẵng.",
      url: SITE_URL,
      image: `${SITE_URL}/api/og`,
      logo: `${SITE_URL}/logo.png`,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Đà Nẵng",
        addressRegion: "Đà Nẵng",
        addressCountry: "VN",
      },
      servesCuisine: ["Matcha", "Coffee", "Tea", "Beverages"],
      hasMenu: `${SITE_URL}/menu`,
      priceRange: "$$",
      currenciesAccepted: "VND",
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <div className="flex flex-col">
        <Hero />
        <Categories />
        <ProductGallery />
        <PromoBanner />
      </div>
    </>
  );
}
