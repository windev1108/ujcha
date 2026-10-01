export type ApiErrorInfo = {
  code?: string;
  message?: string;
  remainingAttempts?: number;
  maxAttempts?: number;
  retryAfterSeconds?: number;
  lockedUntil?: string;
};

export function parseApiError(e: unknown): ApiErrorInfo {
  const err = e as { response?: { data?: ApiErrorInfo }; message?: string };
  const data = err?.response?.data;
  return {
    ...data,
    message: data?.message ?? err?.message,
  };
}