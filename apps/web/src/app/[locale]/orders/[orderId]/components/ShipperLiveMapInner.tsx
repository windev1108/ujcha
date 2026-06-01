"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type LatLng = { lat: number; lng: number };

const MOTO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 26" width="24" height="16" fill="white">
  <circle cx="7.5" cy="20" r="5.5"/>
  <circle cx="7.5" cy="20" r="2" fill="#1a3c34"/>
  <circle cx="32.5" cy="20" r="5.5"/>
  <circle cx="32.5" cy="20" r="2" fill="#1a3c34"/>
  <path d="M12 20 L15 9 L23 9 L32.5 15 L32.5 20 Z"/>
  <path d="M7.5 15 L12 9" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M6 9 L12 9" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/>
  <rect x="16" y="4" width="9" height="6" rx="2.5"/>
</svg>`;

const shipperIcon = L.divIcon({
  html: `<div style="
    background:#1a3c34;
    border-radius:50%;
    width:44px;height:44px;
    border:3px solid #fff;
    box-shadow:0 4px 16px rgba(0,0,0,0.45),0 0 0 3px rgba(26,60,52,0.2);
    display:flex;align-items:center;justify-content:center;
  ">${MOTO_SVG}</div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  className: "",
});

const destIcon = L.divIcon({
  html: `<div style="
    background:#c45c5c;
    border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    width:26px;height:26px;
    border:2.5px solid #fff;
    box-shadow:0 3px 10px rgba(196,92,92,0.55);
    display:flex;align-items:center;justify-content:center;
  "><div style="
    transform:rotate(45deg);
    width:8px;height:8px;
    background:#fff;
    border-radius:50%;
  "></div></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  className: "",
});

function SmoothPan({ location }: { location: LatLng | null }) {
  const map = useMap();
  const prev = useRef<LatLng | null>(null);

  useEffect(() => {
    if (!location) return;
    if (prev.current?.lat === location.lat && prev.current?.lng === location.lng) return;
    prev.current = location;
    map.panTo([location.lat, location.lng], { animate: true, duration: 0.9 });
  }, [location, map]);

  return null;
}

export default function ShipperLiveMapInner({
  shipperLocation,
  destLat,
  destLng,
  fullscreen = false,
}: {
  shipperLocation: LatLng | null;
  destLat?: number | null;
  destLng?: number | null;
  fullscreen?: boolean;
}) {
  const defaultCenter: [number, number] =
    shipperLocation
      ? [shipperLocation.lat, shipperLocation.lng]
      : destLat != null && destLng != null
        ? [destLat, destLng]
        : [10.7769, 106.7009];

  return (
    <div style={{ isolation: "isolate", height: "100%", width: "100%" }}>
      <MapContainer
        center={defaultCenter}
        zoom={15}
        zoomControl={fullscreen}
        scrollWheelZoom={fullscreen}
        dragging={fullscreen}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap"
          maxZoom={19}
        />

        {destLat != null && destLng != null && (
          <Marker position={[destLat, destLng]} icon={destIcon} />
        )}

        {shipperLocation && (
          <>
            <Marker position={[shipperLocation.lat, shipperLocation.lng]} icon={shipperIcon} />
            <SmoothPan location={shipperLocation} />
          </>
        )}
      </MapContainer>
    </div>
  );
}
