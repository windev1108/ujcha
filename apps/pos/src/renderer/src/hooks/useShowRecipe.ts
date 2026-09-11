import { useEffect, useState } from 'react'

const STORAGE_KEY = 'ujcha_pos_show_recipe'

/**
 * Preference toàn cục: hiện/ẩn công thức pha chế trong màn chi tiết đơn.
 * Nhớ lựa chọn qua localStorage — nhân viên đã thuộc công thức có thể tắt để đỡ rối mắt,
 * nhân viên mới bật lên để xem hàm lượng.
 */
export function useShowRecipe() {
    const [showRecipe, setShowRecipe] = useState(false)

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (raw !== null) setShowRecipe(raw === '1')
        } catch { /* ignore */ }
    }, [])

    const toggle = () => {
        setShowRecipe((prev) => {
            const next = !prev
            try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0') } catch { /* ignore */ }
            return next
        })
    }

    return { showRecipe, toggle }
}