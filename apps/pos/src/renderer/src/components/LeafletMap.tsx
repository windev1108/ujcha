import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
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
  return (
    // isolation:isolate creates a new stacking context so Leaflet's internal
    // z-indices (400–600) don't bleed outside and overlay app modals.
    <div style={{ position: 'relative', isolation: 'isolate', height: '100%', width: '100%' }}>
    <MapContainer
      center={[lat, lng]}
      zoom={16}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%', borderRadius: '16px' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lng]} icon={icon}>
        {address && (
          <Popup>
            <span style={{ fontSize: 12, fontWeight: 500 }}>{address}</span>
          </Popup>
        )}
      </Marker>
    </MapContainer>
    </div>
  )
}
