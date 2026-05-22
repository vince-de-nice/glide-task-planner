const EARTH_RADIUS_KM = 6371;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Distance grand cercle entre deux points [lng, lat] (km). */
export function haversineKm(a: [number, number], b: [number, number]): number {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

/** Point sur le grand cercle A→B ; t ∈ [0,1] → départ→arrivée. */
export function interpolateGreatCircle(
  from: [number, number],
  to: [number, number],
  t: number
): [number, number] {
  const [lon1, lat1] = from.map(toRad) as [number, number];
  const [lon2, lat2] = to.map(toRad) as [number, number];

  const x1 = Math.cos(lat1) * Math.cos(lon1);
  const y1 = Math.cos(lat1) * Math.sin(lon1);
  const z1 = Math.sin(lat1);
  const x2 = Math.cos(lat2) * Math.cos(lon2);
  const y2 = Math.cos(lat2) * Math.sin(lon2);
  const z2 = Math.sin(lat2);

  const dot = clamp(x1 * x2 + y1 * y2 + z1 * z2, -1, 1);
  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega);

  let xi: number;
  let yi: number;
  let zi: number;
  if (sinOmega < 1e-9) {
    xi = x1 + (x2 - x1) * t;
    yi = y1 + (y2 - y1) * t;
    zi = z1 + (z2 - z1) * t;
  } else {
    const a = Math.sin((1 - t) * omega) / sinOmega;
    const b = Math.sin(t * omega) / sinOmega;
    xi = a * x1 + b * x2;
    yi = a * y1 + b * y2;
    zi = a * z1 + b * z2;
  }
  const lat = Math.atan2(zi, Math.sqrt(xi * xi + yi * yi));
  const lon = Math.atan2(yi, xi);
  return [toDeg(lon), toDeg(lat)];
}

/** Variante (lng, lat) pour appels ponctuels. */
export function haversineKmCoords(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number
): number {
  return haversineKm([lng1, lat1], [lng2, lat2]);
}
