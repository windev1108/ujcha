"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { io, type Socket } from "socket.io-client";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const TRACKING_NS = "/tracking";

type LatLng = { lat: number; lng: number; timestamp: number };
type Status = "connecting" | "online" | "offline" | "completed";

const TrackingMap = dynamic(() => import("./TrackingMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#ededed] animate-pulse rounded-2xl" />
  ),
});

export function TrackingShell({ orderId }: { orderId: string }) {
  const [status, setStatus] = useState<Status>("connecting");
  const [location, setLocation] = useState<LatLng | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(`${SOCKET_URL}${TRACKING_NS}`, {
      transports: ["websocket"],
      reconnectionDelay: 2_000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("connecting");
      socket.emit("order:watch", { orderId });
    });

    socket.on(
      "order:watch:ok",
      (data: { orderId: string; currentLocation: LatLng | null; status: string }) => {
        if (data.currentLocation) {
          setLocation(data.currentLocation);
          setStatus("online");
        }
        if (data.status === "offline") setStatus("offline");
      },
    );

    socket.on(
      "shipper:location",
      (data: { lat: number; lng: number; timestamp: number }) => {
        setLocation({ lat: data.lat, lng: data.lng, timestamp: data.timestamp });
        setStatus("online");
      },
    );

    socket.on("shipper:offline", () => setStatus("offline"));

    socket.on("order:status", (data: { orderId: string; status: string }) => {
      if (data.orderId === orderId) {
        setOrderStatus(data.status);
        if (data.status === "completed") setStatus("completed");
      }
    });

    socket.on("disconnect", () => setStatus("offline"));

    return () => {
      socket.emit("order:unwatch", { orderId });
      socket.disconnect();
    };
  }, [orderId]);

  const STATUS_CONFIG: Record<Status, { label: string; dot: string; bg: string; text: string }> = {
    connecting: { label: "Đang kết nối…", dot: "bg-amber-400", bg: "bg-amber-50", text: "text-amber-700" },
    online:     { label: "Đang giao hàng", dot: "bg-green-500", bg: "bg-green-50", text: "text-green-700" },
    offline:    { label: "Shipper ngoại tuyến", dot: "bg-gray-400", bg: "bg-gray-100", text: "text-gray-600" },
    completed:  { label: "Đã giao thành công", dot: "bg-teal-500", bg: "bg-teal-50", text: "text-teal-700" },
  };

  const st = STATUS_CONFIG[status];

  return (
    <div className="min-h-screen bg-[#f7f7f7]">
      <div className="max-w-[72rem] mx-auto px-5 py-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#717171] mb-2">
          THEO DÕI ĐƠN HÀNG
        </p>
        <h1 className="text-2xl font-semibold text-[#1a1a1a] mb-6">
          Vị trí shipper thời gian thực
        </h1>

        <div className="flex items-center gap-3 mb-6">
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${st.bg} ${st.text}`}>
            <span className={`w-2 h-2 rounded-full ${st.dot} ${status === "online" ? "animate-pulse" : ""}`} />
            {st.label}
          </span>

          {orderStatus && (
            <span className="text-sm text-[#717171]">
              Đơn hàng: <strong className="text-[#1a1a1a]">{orderStatus}</strong>
            </span>
          )}
        </div>

        <div className="rounded-3xl overflow-hidden border border-black/[0.06] shadow-[0_4px_20px_-8px_rgba(0,0,0,0.10)] bg-white h-[480px]">
          <TrackingMap location={location} status={status} />
        </div>

        {status === "completed" && (
          <div className="mt-6 rounded-2xl bg-teal-50 border border-teal-200 p-5 text-center">
            <p className="text-teal-700 font-semibold text-lg">🎉 Đơn hàng đã được giao thành công!</p>
            <p className="text-teal-600 text-sm mt-1">Cảm ơn bạn đã sử dụng UjCha Delivery.</p>
          </div>
        )}

        {status !== "completed" && (
          <div className="mt-4 text-center text-sm text-[#717171]">
            Vị trí cập nhật tự động • Không cần làm mới trang
          </div>
        )}
      </div>
    </div>
  );
}
