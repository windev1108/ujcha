/**
 * Pickup phải đặt trước ít nhất N phút (buffer). Có thể cấu hình 15–30 qua env sau.
 */
export const MIN_PICKUP_LEAD_MINUTES = 15;

/** Không cho đặt pickup quá xa (tránh slot ảo); tùy business. */
export const MAX_PICKUP_DAYS_AHEAD = 30;
