"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type LatLng = { lat: number; lng: number };

const shipperIcon = L.divIcon({
  html: `<div style="
    background:#1a3c34;border-radius:50%;width:22px;height:22px;
    border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.35);
    display:flex;align-items:center;justify-content:center;
  "><div style="width:7px;height:7px;background:#99d6b3;border-radius:50%"></div></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  className: "",
});

const destIcon = L.divIcon({
  html: `<div style="
    background:#c45c5c;border-radius:50%;width:18px;height:18px;
    border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
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
}: {
  shipperLocation: LatLng | null;
  destLat?: number | null;
  destLng?: number | null;
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
        zoomControl={true}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap"
          maxZoom={19}
        />

        {/* Destination marker */}
        {destLat != null && destLng != null && (
          <Marker position={[destLat, destLng]} icon={destIcon} />
        )}

        {/* Shipper marker — smooth pan on each update */}
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
