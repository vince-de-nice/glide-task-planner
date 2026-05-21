import type { EnvelopeSample } from '../services/glide-envelope.service';
import type { Waypoint } from '../models/waypoint.model';
import { bearingDegrees, destinationPoint } from './obs-zone-map.util';

const EARTH_RADIUS_KM = 6371;
const METERS_PER_PIXEL_ZOOM_0 = 156543.03;

/** Bearing carte : branche horizontale, départ à gauche / arrivée à droite (comme la coupe). */
export function profileMapBearingDeg(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): number {
  const legBearing = bearingDegrees(fromLat, fromLng, toLat, toLng);
  return (legBearing - 90 + 360) % 360;
}

export interface LegMapFitPointsInput {
  from: Waypoint;
  to: Waypoint;
  samples: EnvelopeSample[];
  cones3d: boolean;
  enabledLandables: Waypoint[];
  landableCones: { id: string; mapDisplayRadiusKm: number }[];
  enabledLandableIds: Set<string>;
}

export interface ProfileLegCameraFit {
  center: [number, number];
  zoom: number;
  bearing: number;
}

export interface ProfileLegCameraFitOptions {
  from: Waypoint;
  to: Waypoint;
  legLengthKm: number;
  fitPoints: LegMapFitPointsInput;
  viewportWidthPx: number;
  viewportHeightPx: number;
  paddingPx: { top: number; bottom: number; left: number; right: number };
  maxZoom: number;
  minZoom?: number;
}

/** Points englobants pour le cadrage (marge perpendiculaire aux cônes en 3D). */
export function collectLegMapFitPoints(input: LegMapFitPointsInput): {
  lngs: number[];
  lats: number[];
} {
  const lngs: number[] = [];
  const lats: number[] = [];

  const push = (lng: number, lat: number) => {
    lngs.push(lng);
    lats.push(lat);
  };

  push(input.from.longitude, input.from.latitude);
  push(input.to.longitude, input.to.latitude);
  for (const s of input.samples) {
    push(s.longitude, s.latitude);
  }

  if (!input.cones3d || input.enabledLandables.length === 0) {
    return { lngs, lats };
  }

  const legBearing = bearingDegrees(
    input.from.latitude,
    input.from.longitude,
    input.to.latitude,
    input.to.longitude
  );
  const perpBearing = (legBearing + 90) % 360;
  const reversePerp = (perpBearing + 180) % 360;

  let maxRadiusKm = 2;
  for (const cone of input.landableCones) {
    if (!input.enabledLandableIds.has(cone.id)) continue;
    if (cone.mapDisplayRadiusKm > maxRadiusKm) {
      maxRadiusKm = cone.mapDisplayRadiusKm;
    }
  }
  const marginM = maxRadiusKm * 1000;

  for (const wp of input.enabledLandables) {
    const [latA, lngA] = destinationPoint(
      wp.latitude,
      wp.longitude,
      perpBearing,
      marginM
    );
    const [latB, lngB] = destinationPoint(
      wp.latitude,
      wp.longitude,
      reversePerp,
      marginM
    );
    push(lngA, latA);
    push(lngB, latB);
  }

  return { lngs, lats };
}

/**
 * Cadrage : branche le long de la largeur de l'écran, zoom dérivé de la longueur réelle (km).
 */
export function computeProfileLegCameraFit(
  options: ProfileLegCameraFitOptions
): ProfileLegCameraFit | null {
  const { from, to, legLengthKm } = options;
  if (!Number.isFinite(legLengthKm) || legLengthKm < 0.01) return null;

  const bearing = profileMapBearingDeg(
    from.latitude,
    from.longitude,
    to.latitude,
    to.longitude
  );
  const legBearing = bearingDegrees(
    from.latitude,
    from.longitude,
    to.latitude,
    to.longitude
  );

  const { lngs, lats } = collectLegMapFitPoints(options.fitPoints);
  if (lngs.length === 0) return null;

  const fromLng = from.longitude;
  const fromLat = from.latitude;

  let uMin = 0;
  let uMax = legLengthKm;
  let vMax = 0;

  for (let i = 0; i < lngs.length; i++) {
    const { uKm, vKm } = projectOntoLegKm(
      fromLng,
      fromLat,
      legBearing,
      lngs[i],
      lats[i]
    );
    uMin = Math.min(uMin, uKm);
    uMax = Math.max(uMax, uKm);
    vMax = Math.max(vMax, vKm);
  }

  const alongKm = Math.max(0.5, uMax - uMin) * 1.1;
  const perpKm = Math.max(1, vMax * 2) * 1.12;
  const midUKm = (uMin + uMax) / 2;
  const [centerLat, centerLng] = destinationPoint(
    fromLat,
    fromLng,
    legBearing,
    midUKm * 1000
  );

  const zoom = zoomToFitLegInViewport({
    alongKm,
    perpKm,
    latitudeDeg: centerLat,
    viewportWidthPx: options.viewportWidthPx,
    viewportHeightPx: options.viewportHeightPx,
    paddingPx: options.paddingPx,
    maxZoom: options.maxZoom,
    minZoom: options.minZoom ?? 5
  });

  return {
    center: [centerLng, centerLat],
    zoom,
    bearing
  };
}

function haversineKm(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number
): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin((φ2 - φ1) / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return (2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** Coordonnées le long / perpendiculaire à la branche (km, u=0 au départ). */
function projectOntoLegKm(
  fromLng: number,
  fromLat: number,
  legBearingDeg: number,
  lng: number,
  lat: number
): { uKm: number; vKm: number } {
  const distKm = haversineKm(fromLng, fromLat, lng, lat);
  if (distKm < 1e-6) return { uKm: 0, vKm: 0 };
  const brg = bearingDegrees(fromLat, fromLng, lat, lng);
  let delta = brg - legBearingDeg;
  delta = ((delta % 360) + 360) % 360;
  if (delta > 180) delta -= 360;
  const deltaRad = (delta * Math.PI) / 180;
  return {
    uKm: distKm * Math.cos(deltaRad),
    vKm: Math.abs(distKm * Math.sin(deltaRad))
  };
}

function zoomToFitLegInViewport(params: {
  alongKm: number;
  perpKm: number;
  latitudeDeg: number;
  viewportWidthPx: number;
  viewportHeightPx: number;
  paddingPx: { top: number; bottom: number; left: number; right: number };
  maxZoom: number;
  minZoom: number;
}): number {
  const usableW = Math.max(
    120,
    params.viewportWidthPx - params.paddingPx.left - params.paddingPx.right
  );
  const usableH = Math.max(
    80,
    params.viewportHeightPx - params.paddingPx.top - params.paddingPx.bottom
  );
  const latRad = (params.latitudeDeg * Math.PI) / 180;
  const mpp0 = METERS_PER_PIXEL_ZOOM_0 * Math.cos(latRad);
  const alongM = params.alongKm * 1000;
  const perpM = params.perpKm * 1000;

  const zoomForWidth = Math.log2((usableW * mpp0) / alongM);
  const zoomForHeight = Math.log2((usableH * mpp0) / perpM);
  const fitZoom = Math.min(zoomForWidth, zoomForHeight);

  return Math.min(params.maxZoom, Math.max(params.minZoom, fitZoom));
}
