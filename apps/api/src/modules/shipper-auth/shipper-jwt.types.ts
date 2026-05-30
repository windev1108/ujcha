export const SHIPPER_JWT_TYPE = 'shipper' as const;
export const SHIPPER_JWT_REFRESH_TYPE = 'shipper_refresh' as const;

export type ShipperJwtPayload = {
  sub: string;       // adminId
  shipperId: string;
  typ: typeof SHIPPER_JWT_TYPE;
};

export type ShipperRefreshJwtPayload = {
  sub: string;       // adminId
  shipperId: string;
  typ: typeof SHIPPER_JWT_REFRESH_TYPE;
};

export type ShipperJwtUser = {
  adminId: string;
  shipperId: string;
};
