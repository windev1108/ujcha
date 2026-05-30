"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type LatLng = { lat: number; lng: number; timestamp: number };
type Status = "connecting" | "online" | "offline" | "completed";

const DEFAULT_CENTER: [number, number] = [10.7769, 106.7009];

const shipperIcon = L.divIcon({
  html: `<div style="
    background:#1a3c34;border-radius:50%;width:22px;height:22px;
    border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);
    display:flex;align-items:center;justify-content:center;
  "><div style="width:6px;height:6px;background:#99d6b3;border-radius:50%"></div></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  className: "",
});

function PanToLocation({ location }: { location: LatLng | null }) {
  const map = useMap();
  const prevRef = useRef<LatLng | null>(null);

  useEffect(() => {
    if (!location) return;
    if (
      prevRef.current?.lat === location.lat &&
      prevRef.current?.lng === location.lng
    )
      return;
    prevRef.current = location;
    map.panTo([location.lat, location.lng], { animate: true, duration: 0.8 });
  }, [location, map]);

  return null;
}

export default function TrackingMap({
  location,
  status,
}: {
  location: LatLng | null;
  status: Status;
}) {
  const center: [number, number] = location
    ? [location.lat, location.lng]
    : DEFAULT_CENTER;

  const offline = status === "offline" || status === "connecting";

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={center}
        zoom={15}
        style={{ width: "100%", height: "100%" }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
          maxZoom={19}
        />
        {location && (
          <>
            <Marker position={[location.lat, location.lng]} icon={shipperIcon} />
            <PanToLocation location={location} />
          </>
        )}
      </MapContainer>

      {offline && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none z-[1000]">
          <div className="bg-white rounded-2xl px-5 py-3 shadow-lg text-sm font-semibold text-[#1a1a1a]">
            {status === "connecting" ? "Đang kết nối…" : "Shipper ngoại tuyến"}
          </div>
        </div>
      )}
    </div>
  );
}
