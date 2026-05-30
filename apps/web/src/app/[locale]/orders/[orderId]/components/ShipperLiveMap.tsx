"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { io, type Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type LatLng = { lat: number; lng: number; timestamp: number };
type TrackStatus = "connecting" | "online" | "waiting" | "completed";

const ShipperLiveMapInner = dynamic(() => import("./ShipperLiveMapInner"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-2xl bg-surface-card" />,
});

const STATUS_CONFIG: Record<TrackStatus, {
  label: string; dot: string; dotAnimate: boolean; pill: string; text: string;
}> = {
  connecting: { label: "Đang kết nối…",          dot: "bg-amber-400", dotAnimate: true,  pill: "bg-amber-50 ring-amber-200",  text: "text-amber-700" },
  online:     { label: "Đang giao hàng 🛵",        dot: "bg-green-500", dotAnimate: true,  pill: "bg-green-50 ring-green-200",  text: "text-green-700" },
  waiting:    { label: "Chờ shipper bật GPS…",     dot: "bg-gray-400",  dotAnimate: false, pill: "bg-gray-50 ring-gray-200",    text: "text-gray-500" },
  completed:  { label: "Đã giao thành công ✓",     dot: "bg-teal-500",  dotAnimate: false, pill: "bg-teal-50 ring-teal-200",    text: "text-teal-700" },
};

export function ShipperLiveMap({
  orderId,
  destLat,
  destLng,
  orderStatus,
}: {
  orderId: string;
  destLat?: number | null;
  destLng?: number | null;
  orderStatus: string;
}) {
  const [trackStatus, setTrackStatus] = useState<TrackStatus>("connecting");
  const [location, setLocation] = useState<LatLng | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(`${SOCKET_URL}/tracking`, {
      transports: ["websocket"],
      reconnectionDelay: 2_000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setTrackStatus("connecting");
      socket.emit("order:watch", { orderId });
    });

    socket.on("order:watch:ok", (data: {
      orderId: string;
      currentLocation: LatLng | null;
      status: "online" | "offline";
    }) => {
      if (data.currentLocation) {
        setLocation(data.currentLocation);
        setTrackStatus("online");
      } else {
        setTrackStatus(data.status === "online" ? "online" : "waiting");
      }
    });

    socket.on("shipper:location", (data: { lat: number; lng: number; timestamp: number }) => {
      setLocation({ lat: data.lat, lng: data.lng, timestamp: data.timestamp });
      setTrackStatus("online");
    });

    socket.on("shipper:offline", () => {
      setTrackStatus("waiting");
    });

    socket.on("order:status", (data: { orderId: string; status: string }) => {
      if (data.orderId === orderId && data.status === "completed") {
        setTrackStatus("completed");
      }
    });

    socket.on("disconnect", () => setTrackStatus("waiting"));

    return () => {
      socket.emit("order:unwatch", { orderId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [orderId]);

  // If the order is already completed when the component mounts, show completed state
  useEffect(() => {
    if (orderStatus === "completed") setTrackStatus("completed");
  }, [orderStatus]);

  const st = STATUS_CONFIG[trackStatus];

  return (
    <div className="mt-4 space-y-3">
      {/* Status pill */}
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${st.pill} ${st.text}`}>
          <span className={`size-1.5 rounded-full ${st.dot} ${st.dotAnimate ? "animate-pulse" : ""}`} />
          {st.label}
        </span>
        <span className="text-[10px] text-foreground/40">
          Cập nhật tự động
        </span>
      </div>

      {/* Map */}
      <div className="h-[320px] overflow-hidden rounded-2xl ring-1 ring-black/6">
        <ShipperLiveMapInner
          shipperLocation={location}
          destLat={destLat}
          destLng={destLng}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-1">
        <span className="flex items-center gap-1.5 text-[11px] text-foreground/50">
          <span className="inline-block size-3 rounded-full bg-[#1a3c34] ring-2 ring-white shadow-sm" />
          Shipper
        </span>
        {destLat != null && destLng != null && (
          <span className="flex items-center gap-1.5 text-[11px] text-foreground/50">
            <span className="inline-block size-3 rounded-full bg-[#c45c5c] ring-2 ring-white shadow-sm" />
            Địa chỉ giao
          </span>
        )}
      </div>
    </div>
  );
}
