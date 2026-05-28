import { Search, ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { usePosStore } from '../store/pos-store'
import type { Product, CartItem } from '../types/common'
import { ProductConfigModal } from './ProductConfigModal'

const CARD_COLORS = ['#e8f5e9', '#e3f2fd', '#fce4ec', '#fff3e0', '#f3e5f5', '#e0f7fa']
function cardColor(name: string) { return CARD_COLORS[name.charCodeAt(0) % CARD_COLORS.length] }

function fmt(price: string | number) {
  return Number(price).toLocaleString('vi-VN') + 'đ'
}

function ProductCard({ product, onPress }: { product: Product; onPress: (p: Product) => void }) {
  const sold = product.isSoldOut || !product.isAvailable
  return (
    <button
      onClick={() => !sold && onPress(product)}
      disabled={sold}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-all ${sold
        ? 'cursor-not-allowed border-gray-100 opacity-50'
        : 'border-gray-100 bg-white shadow-sm hover:border-brand/30 hover:shadow-md hover:shadow-brand/10 active:scale-[0.98]'
        }`}
    >
      <div
        className="flex h-30 items-center justify-center overflow-hidden w-full"
        style={{ backgroundColor: product.imageUrls[0] ? '#f5f5f5' : cardColor(product.name) }}
      >
        {product.imageUrls[0] ? (
          <img src={product.imageUrls[0]} alt={product.name} className="h-full w-full object-fill" />
        ) : (
          <span className="text-3xl font-black text-white/70 select-none">{product.name[0]}</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3 w-full">
        <p className="text-sm font-semibold leading-snug text-gray-800 line-clamp-2 text-left">{product.name}</p>
        <div className="mt-auto flex items-center justify-between gap-1">
          <p className="text-base font-bold text-brand">{fmt(product.price)}</p>
        </div>
      </div>

      {sold && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70">
          <span className="rounded-full bg-gray-400 px-3 py-1 text-xs font-bold text-white">Hết hàng</span>
        </div>
      )}

      {!sold && (
        <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
          <span className="text-base font-bold leading-none">+</span>
        </div>
      )}
    </button>
  )
}

export function ProductGrid() {
  const products = usePosStore((s) => s.products)
  const toppings = usePosStore((s) => s.toppings)
  const selectedCategoryId = usePosStore((s) => s.selectedCategoryId)
  const searchQuery = usePosStore((s) => s.searchQuery)
  const setSearchQuery = usePosStore((s) => s.setSearchQuery)
  const addToCart = usePosStore((s) => s.addToCart)
  const isFetching = usePosStore((s) => s.isFetching)

  const [configProduct, setConfigProduct] = useState<Product | null>(null)

  const filtered = products.filter((p) => {
    const matchCat = !selectedCategoryId || p.categoryId === selectedCategoryId
    const matchQ = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCat && matchQ
  })

  const handleAdd = (item: Omit<CartItem, 'cartId'>) => {
    addToCart(item)
  }

  return (
    <>
      <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
        {/* Search bar */}
        <div className="border-b border-gray-100 bg-white px-4 py-2.5">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3">
            <Search className="size-4 shrink-0 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm món…"
              className="h-9 flex-1 bg-transparent text-sm focus:outline-none"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          {isFetching ?
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 2xl:grid-cols-7">
              {[...Array(28)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl bg-gray-200 overflow-hidden">
                  <div className="h-[127.65px] w-full bg-gray-300" />
                  <div className="p-3">
                    <div className="mb-4 h-4 w-3/4 rounded bg-gray-300" />
                    <div className="h-4 w-1/2 rounded bg-gray-300" />
                  </div>
                </div>
              ))}
            </div>
            :
            <>
              {filtered.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-400">
                  <ShoppingBag className="size-12 opacity-40" />
                  <p className="text-sm">Không tìm thấy sản phẩm</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 2xl:grid-cols-7">
                  {filtered.map((p) => (
                    <ProductCard key={p.id} product={p} onPress={setConfigProduct} />
                  ))}
                </div>
              )}
            </>
          }
        </div>
      </div>

      <ProductConfigModal
        product={configProduct}
        toppings={toppings}
        onClose={() => setConfigProduct(null)}
        onConfirm={handleAdd}
      />
    </>
  )
}