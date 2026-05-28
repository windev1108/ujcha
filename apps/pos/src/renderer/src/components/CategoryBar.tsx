import { Grid3X3 } from 'lucide-react'
import { usePosStore } from '../store/pos-store'

export function CategoryBar() {
  const categories = usePosStore((s) => s.categories)
  const selectedId = usePosStore((s) => s.selectedCategoryId)
  const setSelected = usePosStore((s) => s.setSelectedCategoryId)

  const all = [{ id: null, name: 'Tất cả' }, ...categories.map((c) => ({ id: c.id, name: c.name }))]

  return (
    <aside className="flex h-full w-44 shrink-0 flex-col border-r border-gray-100 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Danh mục</p>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2 scrollbar-thin">
        {all.map((cat) => {
          const active = selectedId === cat.id
          return (
            <button
              key={cat.id ?? '__all__'}
              onClick={() => setSelected(cat.id)}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all ${active
                ? 'bg-brand text-white shadow-sm shadow-brand/30'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              {cat.id === null && (
                <Grid3X3 className={`size-4 shrink-0 ${active ? 'text-white/80' : 'text-gray-400'}`} />
              )}
              <span className="truncate">{cat.name}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
