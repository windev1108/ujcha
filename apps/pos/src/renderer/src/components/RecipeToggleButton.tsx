import { Eye, EyeOff } from 'lucide-react'

export function RecipeToggleButton({ show, onToggle }: { show: boolean; onToggle: () => void }) {
    return (
        <button
            onClick={onToggle}
            title={show ? 'Ẩn công thức pha chế' : 'Hiện công thức pha chế'}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${show
                    ? 'bg-teal-100 text-teal-700 hover:bg-teal-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
        >
            {show ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            Công thức
        </button>
    )
}