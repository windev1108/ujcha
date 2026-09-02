"use client";

import { ServerCrashIcon } from "lucide-react";

export function MaintenanceOverlay() {
    const maintainTitle = process.env.NEXXT_PUBLIC_MAINTENANCE_TITLE ?? "Website đang được bảo trì"
    const maintainMessage = process.env.NEXT_PUBLIC_MAINTENANCE_MESSAGE ?? `Chúng tôi đang nâng cấp hệ thống để mang lại trải nghiệm tốt hơn.
                    Rất xin lỗi vì sự bất tiện này, vui lòng quay lại sau ít phút.`
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm">
            <div className="mx-4 flex max-w-md flex-col items-center gap-4 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
                    <ServerCrashIcon />
                </span>

                <h2 className="text-xl font-semibold text-foreground">
                    {maintainTitle}
                </h2>

                <p className="text-sm text-muted-foreground">
                    {maintainMessage}
                </p>
            </div>
        </div>
    );
}