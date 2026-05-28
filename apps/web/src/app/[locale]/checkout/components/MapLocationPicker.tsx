"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, MapPin, Navigation, X } from "lucide-react";

// Re-use the same fix for webpack-broken default icons
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type LatLngLike = { lat: number; lng: number };

function CenterTracker({ onChange }: { onChange: (ll: LatLngLike) => void }) {
  useMapEvents({
    moveend(e) {
      const c = (e.target as L.Map).getCenter();
      onChange({ lat: c.lat, lng: c.lng });
    },
  });
  return null;
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  const prevRef = useRef<string | null>(null);
  useEffect(() => {
    if (!target) return;
    const key = `${target[0]},${target[1]}`;
    if (key === prevRef.current) return;
    prevRef.current = key;
    map.flyTo(target, 16, { duration: 1.2 });
  }, [target, map]);
  return null;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=vi`,
      { headers: { "User-Agent": "KunRituals/1.0" } },
    );
    const data = (await resp.json()) as { display_name?: string };
    return data.display_name ?? "";
  } catch {
    return "";
  }
}

type Props = {
  initialLat?: number | null;
  initialLng?: number | null;
  onConfirm: (lat: number, lng: number, address: string) => void;
  onClose: () => void;
};

export function MapLocationPicker({ initialLat, initialLng, onConfirm, onClose }: Props) {
  const hasInitialCoords = initialLat != null && initialLng != null;

  // Fall back to HCM only as the MapContainer seed — real position is acquired below
  const mapSeedCenter: [number, number] = [
    initialLat ?? 10.7769,
    initialLng ?? 106.7009,
  ];

  const [center, setCenter] = useState<LatLngLike>({ lat: mapSeedCenter[0], lng: mapSeedCenter[1] });
  const [addressPreview, setAddressPreview] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLocating, setIsLocating] = useState(!hasInitialCoords);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleGeocode = useCallback((lat: number, lng: number) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setIsGeocoding(true);
    debounceTimer.current = setTimeout(async () => {
      const addr = await reverseGeocode(lat, lng);
      setAddressPreview(addr);
      setIsGeocoding(false);
    }, 700);
  }, []);

  useEffect(() => {
    if (hasInitialCoords) {
      // Already have coords from the form — geocode immediately
      scheduleGeocode(mapSeedCenter[0], mapSeedCenter[1]);
    } else {
      // No coords yet: auto-acquire GPS, skip geocoding HCM
      if (!navigator.geolocation) {
        setIsLocating(false);
        scheduleGeocode(mapSeedCenter[0], mapSeedCenter[1]);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setFlyTarget([pos.coords.latitude, pos.coords.longitude]);
          setIsLocating(false);
          // moveend from flyTo will trigger handleCenterChange → scheduleGeocode
        },
        () => {
          // GPS denied/timeout — stay at HCM and geocode it
          setIsLocating(false);
          scheduleGeocode(mapSeedCenter[0], mapSeedCenter[1]);
        },
        { timeout: 8_000 },
      );
    }

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCenterChange = useCallback(
    (ll: LatLngLike) => {
      setCenter(ll);
      scheduleGeocode(ll.lat, ll.lng);
    },
    [scheduleGeocode],
  );

  function handleGetGPS() {
    if (!navigator.geolocation) {
      setGeoError("Trình duyệt không hỗ trợ định vị.");
      return;
    }
    setGeoError(null);
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFlyTarget([pos.coords.latitude, pos.coords.longitude]);
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
        setGeoError("Không thể lấy vị trí. Vui lòng cấp quyền định vị.");
      },
      { timeout: 8_000 },
    );
  }

  async function handleConfirm() {
    setIsConfirming(true);
    let address = addressPreview;
    if (!address) {
      address = await reverseGeocode(center.lat, center.lng);
    }
    if (!address) {
      address = `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`;
    }
    setIsConfirming(false);
    onConfirm(center.lat, center.lng, address);
  }

  return (
    <div className="fixed inset-0 z-[9998] flex flex-col bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-black/6 bg-white px-4 py-3 shadow-sm">
        <button
          type="button"
          onClick={onClose}
          className="flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-surface-card"
          aria-label="Đóng bản đồ"
        >
          <X className="size-5 text-foreground/70" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Địa chỉ giao hàng
          </p>
          <h2 className="text-sm font-semibold text-foreground">Chọn vị trí trên bản đồ</h2>
        </div>

        <button
          type="button"
          onClick={handleGetGPS}
          disabled={isLocating}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-card px-3 py-2 text-xs font-medium text-kun-products-forest ring-1 ring-black/6 transition-colors hover:ring-black/10 disabled:opacity-50"
        >
          {isLocating ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Navigation className="size-3.5" />
          )}
          Vị trí của tôi
        </button>
      </div>

      {/* Map */}
      <div className="relative min-h-0 flex-1">
        <MapContainer
          center={mapSeedCenter}
          zoom={15}
          style={{ height: "100%", width: "100%", zIndex: 0 }}
          zoomControl
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <CenterTracker onChange={handleCenterChange} />
          <FlyTo target={flyTarget} />
        </MapContainer>

        {/* Initial GPS loading overlay — only on first open with no coords */}
        {isLocating && (
          <div className="absolute inset-0 z-[1001] flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-sm">
            <Loader2 className="size-7 animate-spin text-kun-primary" />
            <p className="text-sm font-medium text-foreground/70">Đang lấy vị trí của bạn…</p>
          </div>
        )}

        {/* Fixed crosshair pin at map center */}
        <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center">
          <div className="-translate-y-5">
            <MapPin
              className="size-9 drop-shadow-lg"
              style={{ fill: "#1a3c34", stroke: "white", strokeWidth: 1.5 }}
            />
            {/* Shadow dot under pin */}
            <div className="mx-auto mt-px h-1 w-2.5 rounded-full bg-black/20 blur-[2px]" />
          </div>
        </div>

        {/* Tip label */}
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-[1000] -translate-x-1/2">
          <div className="rounded-full border border-black/6 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-foreground/70 shadow-sm backdrop-blur-sm">
            Kéo bản đồ để đặt vị trí
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 space-y-3 border-t border-black/6 bg-white p-4 shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.08)]">
        <div className="flex min-h-[40px] items-start gap-2">
          <MapPin className="mt-0.5 size-4 shrink-0 text-kun-products-forest" />
          <div className="min-w-0 flex-1">
            {isLocating ? (
              <div className="flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin text-muted" />
                <span className="text-xs text-muted">Đang tìm vị trí của bạn…</span>
              </div>
            ) : isGeocoding ? (
              <div className="flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin text-muted" />
                <span className="text-xs text-muted">Đang xác định địa chỉ…</span>
              </div>
            ) : addressPreview ? (
              <p className="line-clamp-2 text-sm leading-snug text-foreground">{addressPreview}</p>
            ) : (
              <p className="text-xs tabular-nums text-muted">
                {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
              </p>
            )}
          </div>
        </div>

        {geoError && <p className="text-xs text-red-500">{geoError}</p>}

        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={isConfirming || isGeocoding}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-kun-primary text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isConfirming ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Đang xác nhận…
            </>
          ) : (
            "Xác nhận vị trí này"
          )}
        </button>
      </div>
    </div>
  );
}
