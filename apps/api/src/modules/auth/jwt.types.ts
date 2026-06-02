/** Payload access token sau khi verify (chuẩn JWT `sub`) */
export type JwtAccessPayload = {
  sub: string;
};

/** Payload refresh token — `sid` trỏ thẳng đến Session.id để tránh full-table scan */
export type JwtRefreshPayload = {
  sub: string;
  sid: string;
};
