export const STORE_SESSION_PREFIX = "ujcha_store_status_seen";
export const STORE_STATUS_DISMISSED_EVENT = "ujcha:store-status-dismissed";

export interface PublicStoreLocation {
    lat: number;
    lng: number;
    radiusMeters: number;
    address: string;
    phone: string | null;
}
export type StoreOperationStatus = "opening" | "closed" | "busy";

export interface StoreStatus {
    id: string;
    openMinutes: number;
    closeMinutes: number;
    status: StoreOperationStatus;
    statusReason: string | null;
    updatedAt: string;
    withinHours: boolean;
    effectiveStatus: StoreOperationStatus;
    isOpenForOrders: boolean;
}


export interface PublicDeliveryPlatform {
    id: string
    name: string
    link: string
    thumbnailUrl: string
    displayMode: 'logo_and_text' | 'logo_only'
    logoWidth: number
    logoHeight: number
}

export type AnnouncementType = "info" | "feature" | "warning";
export type AnnouncementFrequency = "session" | "once";

export interface PublicAnnouncement {
    type: AnnouncementType;
    frequency: AnnouncementFrequency;
    title: string;
    content: string;
    ctaLabel: string | null;
    ctaUrl: string | null;
    imageUrl: string | null;
    version: number;
}