"use client";

import { Card, CardContent } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { fetchAdminIngredients } from "@/services/admin/ingredients-api";

const forest = "#14532d";
const amber = "#d97706";
const red = "#dc2626";
const grid = "rgba(0,0,0,0.06)";

export function InventoryStatsTab() {
    const { data: ingredients = [], isLoading } = useQuery({
        queryKey: ["admin", "ingredients"],
        queryFn: () => fetchAdminIngredients(),
    });

    const rows = ingredients.map((ing) => {
        const stock = Number.parseFloat(ing.stockQty) || 0;
        const threshold =
            ing.lowStockThreshold != null ? Number.parseFloat(ing.lowStockThreshold) : null;
        const isOut = stock <= 0;
        const isLow = !isOut && threshold != null && stock <= threshold;
        return { ...ing, stock, threshold, isOut, isLow };
    });

    const total = rows.length;
    const outCount = rows.filter((r) => r.isOut).length;
    const lowCount = rows.filter((r) => r.isLow).length;
    const inactiveCount = rows.filter((r) => !r.isActive).length;

    const chartData = [...rows]
        .filter((r) => r.isActive)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 15)
        .map((r) => ({
            name: r.name,
            stock: r.stock,
            unit: r.unit,
            color: r.isOut ? red : r.isLow ? amber : forest,
        }));

    return (
        <div className="flex flex-col gap-6">
            {/* Stat strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                    [
                        { label: "Tổng nguyên liệu", count: total, accent: "text-[#1a3c34]", bg: "bg-white", border: "border-black/8" },
                        { label: "Sắp hết hàng", count: lowCount, accent: "text-amber-700", bg: "bg-amber-50/70", border: "border-amber-600/12" },
                        { label: "Đã hết hàng", count: outCount, accent: "text-red-700", bg: "bg-red-50/70", border: "border-red-600/12" },
                        { label: "Ngừng dùng", count: inactiveCount, accent: "text-zinc-500", bg: "bg-[#fafafa]", border: "border-black/6" },
                    ] as const
                ).map((stat) => (
                    <div key={stat.label} className={`flex flex-col gap-1 rounded-2xl border p-4 ${stat.bg} ${stat.border}`}>
                        <span className={`text-2xl font-bold tabular-nums ${stat.accent}`}>
                            {isLoading ? (
                                <span className="inline-block h-7 w-10 animate-pulse rounded-lg bg-black/8" />
                            ) : (
                                stat.count
                            )}
                        </span>
                        <span className="text-[11px] font-semibold text-foreground/55">{stat.label}</span>
                    </div>
                ))}
            </div>

            {/* Chart */}
            <Card className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_12px_40px_-24px_rgba(0,0,0,0.15)]">
                <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">
                            Tồn kho thấp nhất
                        </p>
                        <p className="mt-1 text-sm text-foreground/60">
                            15 nguyên liệu (đang dùng) tồn kho thấp nhất — đỏ: đã hết, cam: dưới ngưỡng cảnh báo
                        </p>
                    </div>

                    {isLoading ? (
                        <div className="h-[280px] animate-pulse rounded-xl bg-black/[0.04]" />
                    ) : chartData.length === 0 ? (
                        <div className="flex h-[200px] items-center justify-center text-sm text-foreground/40">
                            Chưa có nguyên liệu nào.
                        </div>
                    ) : (
                        <div className="h-[320px] w-full min-h-[320px]">
                            <ResponsiveContainer width="100%" height={320}>
                                <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                                    <CartesianGrid stroke={grid} horizontal={false} />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        width={120}
                                        tick={{ fill: "var(--muted)", fontSize: 11 }}
                                    />
                                    <Tooltip
                                        cursor={{ fill: "rgba(0,0,0,0.03)" }}
                                        content={({ active, payload }) => {
                                            if (!active || !payload?.length) return null;
                                            const d = payload[0]?.payload as { name: string; stock: number; unit: string };
                                            return (
                                                <div
                                                    style={{
                                                        borderRadius: 12,
                                                        border: "1px solid rgba(0,0,0,0.06)",
                                                        background: "#fff",
                                                        padding: "10px 14px",
                                                        boxShadow: "0 12px 40px -20px rgba(0,0,0,0.2)",
                                                    }}
                                                >
                                                    <p style={{ fontSize: 12, fontWeight: 700, color: "#1a3c34" }}>{d.name}</p>
                                                    <p style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                                                        {d.stock} {d.unit}
                                                    </p>
                                                </div>
                                            );
                                        }}
                                    />
                                    <Bar dataKey="stock" radius={[0, 6, 6, 0]} barSize={14}>
                                        {chartData.map((entry, i) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}