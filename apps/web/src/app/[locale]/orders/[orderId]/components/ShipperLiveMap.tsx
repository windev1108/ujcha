"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { io, type Socket } from "socket.io-client";
import { useTranslations } from "next-intl";
import { Maximize2, X, Bike, MapPin } from "lucide-react";
import { createPortal } from "react-dom";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

type LatLng = { lat: number; lng: number; timestamp: number };
type TrackStatus = "connecting" | "online" | "waiting" | "completed";

const ShipperLiveMapInner = dynamic(() => import("./ShipperLiveMapInner"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-card" />,
});

function FullscreenMap({
  location,
  destLat,
  destLng,
  onClose,
}: {
  location: LatLng | null;
  destLat?: number | null;
  destLng?: number | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
      {/* Header bar */}
      <div className="flex h-12 shrink-0 items-center justify-between bg-black/70 px-4 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Bike className="size-4 text-white/70" />
          <span className="text-sm font-semibold text-white">Live tracking</span>
          {location && (
            <span className="flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-[11px] font-semibold text-green-400">
              <span className="size-1.5 animate-pulse rounded-full bg-green-400" />
              Live
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <X className="size-4" />
        </button>
      </div>
      {/* Fullscreen map */}
      <div className="flex-1">
        <ShipperLiveMapInner
          shipperLocation={location}
          destLat={destLat}
          destLng={destLng}
          fullscreen={true}
        />
      </div>
    </div>,
    document.body,
  );
}

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
  const [fullscreen, setFullscreen] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const t = useTranslations();

  const STATUS_CONFIG: Record<TrackStatus, {
    label: string;
    dot: string;
    dotAnimate: boolean;
    pill: string;
    text: string;
  }> = {
    connecting: {
      label: t("connecting"),
      dot: "bg-amber-400", dotAnimate: true,
      pill: "bg-amber-500/15 ring-amber-400/40", text: "text-amber-300",
    },
    online: {
      label: t("online"),
      dot: "bg-green-400", dotAnimate: true,
      pill: "bg-green-500/15 ring-green-400/40", text: "text-green-300",
    },
    waiting: {
      label: t("waiting_shipper_turn_on_location"),
      dot: "bg-gray-400", dotAnimate: false,
      pill: "bg-white/15 ring-white/25", text: "text-white/70",
    },
    completed: {
      label: t("status_completed"),
      dot: "bg-teal-400", dotAnimate: false,
      pill: "bg-teal-500/15 ring-teal-400/40", text: "text-teal-300",
    },
  };

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

  useEffect(() => {
    if (orderStatus === "completed") setTrackStatus("completed");
  }, [orderStatus]);

  const st = STATUS_CONFIG[trackStatus];

  return (
    <>
      <div className="mt-4">
        {/* Map container — clickable to fullscreen */}
        <div
          className="group relative h-[260px] cursor-pointer overflow-hidden rounded-2xl ring-1 ring-black/6"
          onClick={() => setFullscreen(true)}
          title={t("tap_to_fullscreen")}
        >
          {/* Map */}
          <div className="absolute inset-0">
            <ShipperLiveMapInner
              shipperLocation={location}
              destLat={destLat}
              destLng={destLng}
            />
          </div>

          {/* Status pill — top-left overlay */}
          <div className="absolute left-3 top-3" style={{ zIndex: 1000 }}>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold ring-1 backdrop-blur-md ${st.pill} ${st.text}`}>
              <span className={`size-1.5 rounded-full ${st.dot} ${st.dotAnimate ? "animate-pulse" : ""}`} />
              {st.label}
            </span>
          </div>

          {/* Fullscreen button — top-right */}
          <div
            className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100"
            style={{ zIndex: 1000 }}
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm ring-1 ring-white/20">
              <Maximize2 className="size-3.5" />
            </span>
          </div>

          {/* Legend — bottom-left overlay */}
          <div className="absolute bottom-3 left-3" style={{ zIndex: 1000 }}>
            <div className="flex flex-col gap-1 rounded-xl bg-white/85 px-2.5 py-1.5 shadow-sm backdrop-blur-md ring-1 ring-black/6">
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-foreground/65">
                <Bike className="size-3 shrink-0 text-[#1a3c34]" />
                Shipper
              </span>
              {destLat != null && destLng != null && (
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-foreground/65">
                  <MapPin className="size-3 shrink-0 text-[#c45c5c]" />
                  {t("delivery_address_title")}
                </span>
              )}
            </div>
          </div>

          {/* Waiting overlay */}
          {trackStatus === "waiting" && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/75 backdrop-blur-[2px]"
              style={{ zIndex: 900 }}
            >
              <div className="flex size-12 items-center justify-center rounded-2xl bg-white shadow-md ring-1 ring-black/6">
                <Bike className="size-6 text-foreground/30" />
              </div>
              <p className="text-xs font-medium text-foreground/50">{t("waiting_shipper_turn_on_location")}</p>
            </div>
          )}

          {/* Tap hint */}
          <div
            className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/8 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
            style={{ zIndex: 800 }}
          />
        </div>

        {/* Auto-update note */}
        <p className="mt-1.5 text-right text-[10px] text-foreground/35">{t("update_automatically")}</p>
      </div>

      {fullscreen && (
        <FullscreenMap
          location={location}
          destLat={destLat}
          destLng={destLng}
          onClose={() => setFullscreen(false)}
        />
      )}
    </>
  );
}
