"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Pane, TileLayer, Tooltip, useMap } from "react-leaflet";

import { formatVnd } from "@/lib/product-display";
import { CustomerCell } from "@/services/admin/types";
import { animate } from "motion/react";

const MIN_RADIUS_PX = 6;
const MAX_RADIUS_PX = 32;
const MIN_FULL_SCALE = 10;

function startPing(el: SVGElement, delay: number) {
    el.style.transformBox = "fill-box"; // scale quanh tâm của chính vòng tròn
    el.style.transformOrigin = "center";
    el.style.pointerEvents = "none";
    return animate(
        el,
        { scale: [1, 2.4], opacity: [0.6, 0] },
        { duration: 2, delay, repeat: Infinity, ease: [0, 0, 0.2, 1] },
    );
}
function FitBounds({ cells }: { cells: CustomerCell[] }) {
    const map = useMap();

    useEffect(() => {
        if (!cells.length) return;
        map.fitBounds(
            [
                [Math.min(...cells.map((c) => c.lat0)), Math.min(...cells.map((c) => c.lng0))],
                [Math.max(...cells.map((c) => c.lat1)), Math.max(...cells.map((c) => c.lng1))],
            ],
            { padding: [30, 30], maxZoom: 15 },
        );
    }, [cells, map]);
    return null;
}

export default function CustomerGeoMap({ cells }: { cells: CustomerCell[] }) {
    const fullScale = Math.max(MIN_FULL_SCALE, ...cells.map((c) => c.customers));
    return (
        <MapContainer
            center={[10.78, 106.7]}
            zoom={12}
            scrollWheelZoom
            className="relative z-0 h-[420px] w-full rounded-xl"
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds cells={cells} />
            {/* Lớp ring: nằm dưới, không nhận chuột */}
            <Pane name="customer-rings" style={{ zIndex: 450, pointerEvents: "none" }}>
                {cells.map((c, idx) => {
                    const ratio = Math.sqrt((c.customers - 1) / (fullScale - 1));
                    const radius = MIN_RADIUS_PX + (MAX_RADIUS_PX - MIN_RADIUS_PX) * ratio;
                    return (
                        <CircleMarker
                            key={`ring-${c.lat0}|${c.lng0}`}
                            center={[(c.lat0 + c.lat1) / 2, (c.lng0 + c.lng1) / 2]}
                            radius={radius}
                            interactive={false}
                            pane="customer-rings"
                            pathOptions={{
                                className: "customer-ring",
                                color: "#1a3c34",
                                weight: 2,
                                fill: false,
                            }}
                            eventHandlers={{
                                add: (e) => {
                                    const el = e.target.getElement() as SVGElement | undefined;
                                    if (el) el.style.animationDelay = `${(idx % 8) * 0.22}s`;
                                },
                            }}
                        />
                    );
                })}
            </Pane>

            {/* Lớp chính: box giữ nguyên + hover tooltip */}
            {cells.map((c) => {
                const ratio = Math.sqrt((c.customers - 1) / (fullScale - 1));
                const radius = MIN_RADIUS_PX + (MAX_RADIUS_PX - MIN_RADIUS_PX) * ratio;
                const baseOpacity = 0.25 + 0.45 * ratio;

                return (
                    <CircleMarker
                        key={`main-${c.lat0}|${c.lng0}`}
                        center={[(c.lat0 + c.lat1) / 2, (c.lng0 + c.lng1) / 2]}
                        radius={radius}
                        pathOptions={{
                            color: "#1a3c34",
                            weight: 1,
                            fillColor: "#1a3c34",
                            fillOpacity: baseOpacity,
                        }}
                        eventHandlers={{
                            mouseover: (e) => e.target.setStyle({ weight: 2, fillOpacity: 0.85 }),
                            mouseout: (e) => e.target.setStyle({ weight: 1, fillOpacity: baseOpacity }),
                        }}
                    >
                        <Tooltip sticky>
                            <b>{c.customers.toLocaleString("vi-VN")} khách</b>
                            <br />
                            {c.orders.toLocaleString("vi-VN")} đơn · {formatVnd(c.revenue)}
                        </Tooltip>
                    </CircleMarker>
                );
            })}
        </MapContainer>
    );
}