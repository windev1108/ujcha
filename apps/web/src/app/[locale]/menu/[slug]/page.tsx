import type { Metadata } from 'next'
import { fetchProductBySlug } from '@/services/product/api'
import { ProductDetailPageShell } from './components/ProductDetailPageShell'
import { getDisplayName, getDisplayDescription } from '@/lib/product-name'

const _rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ujcha.vercel.app";
const SITE_URL = _rawSiteUrl.startsWith("http") ? _rawSiteUrl : `https://${_rawSiteUrl}`;

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { slug, locale } = await params

  try {
    const product = await fetchProductBySlug(slug, locale)
    const image = product.imageUrls?.[0]
    const price = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
      Number(product.price),
    )
    const displayName = getDisplayName(product, locale)
    const description =
      getDisplayDescription(product, locale) ||
      `${displayName} — ${price}. Đặt hàng tại UjCha, matcha & đồ uống thủ công chất lượng cao.`

    return {
      title: displayName,
      description,
      openGraph: {
        type: 'website',
        url: `${SITE_URL}/menu/${slug}`,
        title: `${displayName} | UjCha`,
        description,
        siteName: 'UjCha',
        ...(image && {
          images: [{ url: image, width: 800, height: 800, alt: displayName }],
        }),
      },
      twitter: {
        card: 'summary_large_image',
        title: `${displayName} | UjCha`,
        description,
        ...(image && { images: [image] }),
      },
    }
  } catch {
    return {
      title: 'Sản phẩm | UjCha',
      description: 'Khám phá matcha & đồ uống thủ công tại UjCha.',
    }
  }
}

export default function ProductDetailPage() {
  return <ProductDetailPageShell />
}
