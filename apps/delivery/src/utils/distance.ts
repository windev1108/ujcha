export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function speedKmh(
  lat1: number, lng1: number, ts1: number,
  lat2: number, lng2: number, ts2: number,
): number {
  const dtS = (ts2 - ts1) / 1000;
  if (dtS <= 0) return 0;
  return (haversineMeters(lat1, lng1, lat2, lng2) / dtS) * 3.6;
}
