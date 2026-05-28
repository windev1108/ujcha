/**
 * Ngưỡng anti-fraud — có thể chuyển sang env sau (FRAUD_*).
 * Giữ tách file để mở rộng rule / scoring.
 */
export const FRAUD_LIMITS = {
  /** Trùng rule OTP hiện tại: 3 request / 10 phút / phone hoặc / IP */
  OTP_PER_PHONE_WINDOW: 3,
  OTP_PER_IP_WINDOW: 3,
  OTP_WINDOW_MINUTES: 10,

  /** Tối đa số user khác nhau đã có session trên cùng deviceId */
  MAX_DISTINCT_ACCOUNTS_PER_DEVICE: 5,

  /** Cùng registrationIp: nhiều tài khoản tạo trong cửa sổ ngắn → đáng ngờ */
  RAPID_SIGNUP_WINDOW_MINUTES: 60,
  RAPID_SIGNUP_MAX_ACCOUNTS_SAME_IP: 3,

  /** Cùng registrationIp trong 24h */
  SAME_IP_WINDOW_HOURS: 24,
  SAME_IP_MAX_ACCOUNTS: 5,
} as const;

export const FRAUD_REASON_CODES = {
  RAPID_SIGNUPS_SAME_IP: 'rapid_signups_same_ip',
  MANY_ACCOUNTS_SAME_IP_24H: 'many_accounts_same_ip_24h',
} as const;
