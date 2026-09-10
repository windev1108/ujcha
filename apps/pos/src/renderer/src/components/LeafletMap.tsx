import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

interface Props {
  lat: number
  lng: number
  address?: string
}

export function LeafletMap({ lat, lng, address }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 16,
      scrollWheelZoom: false,
    })
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    const marker = L.marker([lat, lng], { icon }).addTo(map)
    if (address) {
      marker.bindPopup(
        `<span style="font-size:12px;font-weight:500">${escapeHtml(address)}</span>`
      )
    }

    // Container có thể chưa có kích thước thật lúc L.map() chạy (modal
    // đang animate / vừa mount), khiến tile layer tính sai grid và
    // không tải tile nào. invalidateSize() buộc Leaflet tính lại kích
    // thước + tải đúng tile khi container đã ổn định.
    const ro = new ResizeObserver(() => {
      map.invalidateSize()
    })
    ro.observe(containerRef.current)

    // Gọi thêm 1 lần ở frame kế tiếp để chắc chắn (một số trường hợp
    // ResizeObserver không bắn nếu size không đổi lần đầu).
    requestAnimationFrame(() => map.invalidateSize())

    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [lat, lng, address])

  return (
    <div style={{ position: 'relative', isolation: 'isolate', height: '100%', width: '100%' }}>
      <div
        ref={containerRef}
        style={{ height: '100%', width: '100%', borderRadius: '16px' }}
      />
    </div>
  )
}

function escapeHtml(s: string) {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}