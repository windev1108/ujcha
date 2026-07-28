export const PAYMENT_REMINDER_QUEUE = 'payment-reminder';

// 0p / 5p / 15p / 30p / 2h — tính từ lúc lock đơn (bank_transfer)
export const REMINDER_DELAYS_MS = [
    0,
    5 * 60_000,
    15 * 60_000,
    30 * 60_000,
    2 * 3_600_000,
];

export interface ReminderJobData {
    participantId: string;
    paymentCode: string;
    step: number;
}