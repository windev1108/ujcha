import type { Metadata } from 'next'
import { fetchProductBySlug } from '@/services/product/api'
import { ProductDetailPageShell } from './components/ProductDetailPageShell'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kun.vn'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { slug } = await params

  try {
    const product = await fetchProductBySlug(slug)
    const image = product.imageUrls?.[0]
    const price = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
      Number(product.price),
    )
    const description =
      product.description?.trim() ||
      `${product.name} — ${price}. Đặt hàng tại UjCha, matcha & đồ uống thủ công chất lượng cao.`

    return {
      title: product.name,
      description,
      openGraph: {
        type: 'website',
        url: `${SITE_URL}/menu/${slug}`,
        title: `${product.name} | UjCha`,
        description,
        siteName: 'UjCha',
        ...(image && {
          images: [{ url: image, width: 800, height: 800, alt: product.name }],
        }),
      },
      twitter: {
        card: 'summary_large_image',
        title: `${product.name} | UjCha`,
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
