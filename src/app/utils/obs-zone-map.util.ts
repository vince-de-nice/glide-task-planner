import { CircuitLeg, CircuitLegRole } from '../models/circuit.model';
import {
  ObservationZoneConfig,
  defaultObservationZoneForRole,
  normalizeObservationZone
} from '../models/observation-zone.model';
import { Waypoint } from '../models/waypoint.model';

export type LatLngTuple = [number, number];

export type ObsZoneMapShapeKind =
  | 'circle'
  | 'sector'
  | 'ring-sector'
  | 'fai-keyhole'
  | 'line';

export interface ObsZoneMapShape {
  kind: ObsZoneMapShapeKind;
  legIndex: number;
  role: CircuitLegRole;
  center: LatLngTuple;
  /** Cercle plein ou secteur : rayon extérieur (m). */
  radiusM?: number;
  innerRadiusM?: number;
  /** Bords A1 (anneau) : start = gauche, end = droite. */
  startBearingDeg?: number;
  endBearingDeg?: number;
  /** Bords A2 (secteur intérieur), keyhole FAI uniquement. */
  innerStartBearingDeg?: number;
  innerEndBearingDeg?: number;
  linePoints?: LatLngTuple[];
  label: string;
}

export interface ObsZoneLegContext {
  legIndex: number;
  leg: CircuitLeg;
  waypoint: Waypoint;
  prev: Waypoint | null;
  next: Waypoint | null;
  departure: Waypoint | null;
  defaultRadiusM: number;
}

const EARTH_RADIUS_M = 6_371_000;

/** Cap initial (°) de A vers B, sens horaire depuis le nord. */
export function bearingDegrees(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Point à distance (m) et cap (°) depuis lat/lon. */
export function destinationPoint(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceM: number
): LatLngTuple {
  const δ = distanceM / EARTH_RADIUS_M;
  const θ = (bearingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );

  return [(φ2 * 180) / Math.PI, (((λ2 * 180) / Math.PI + 540) % 360) - 180];
}

export function sectorPolygonLatLngs(
  center: LatLngTuple,
  radiusM: number,
  startBearingDeg: number,
  endBearingDeg: number,
  steps = 36
): LatLngTuple[] {
  return arcPolygon(center, radiusM, startBearingDeg, endBearingDeg, steps);
}

export function ringSectorPolygonLatLngs(
  center: LatLngTuple,
  outerM: number,
  innerM: number,
  startBearingDeg: number,
  endBearingDeg: number,
  steps = 36
): LatLngTuple[] {
  return ringSectorPolygon(center, outerM, innerM, startBearingDeg, endBearingDeg, steps);
}

/** Points d’arc de `fromBrg` vers `toBrg` (sans le point de départ). */
function arcPointsBetween(
  center: LatLngTuple,
  radiusM: number,
  fromBrg: number,
  toBrg: number,
  clockwise: boolean,
  steps = 16
): LatLngTuple[] {
  const [lat, lon] = center;
  const pts: LatLngTuple[] = [];
  if (clockwise) {
    let start = fromBrg;
    let end = toBrg;
    while (end <= start) {
      end += 360;
    }
    for (let i = 1; i <= steps; i++) {
      const b = start + ((end - start) * i) / steps;
      pts.push(destinationPoint(lat, lon, b % 360, radiusM));
    }
  } else {
    let start = fromBrg;
    let end = toBrg;
    while (start <= end) {
      start += 360;
    }
    for (let i = 1; i <= steps; i++) {
      const b = start - ((start - end) * i) / steps;
      pts.push(destinationPoint(lat, lon, ((b % 360) + 360) % 360, radiusM));
    }
  }
  return pts;
}

/**
 * Polygone keyhole FAI (union secteur A2 + anneau A1), même périmètre que l’aperçu SVG.
 */
export function faiKeyholePolygonLatLngs(
  center: LatLngTuple,
  outerM: number,
  innerM: number,
  bA2Left: number,
  bA2Right: number,
  bA1Left: number,
  bA1Right: number,
  steps = 16
): LatLngTuple[] {
  const [lat, lon] = center;
  const gapCW = ((bA2Left - bA1Left + 360) % 360) > 180;
  const pts: LatLngTuple[] = [center];
  pts.push(destinationPoint(lat, lon, bA2Left, innerM));
  pts.push(...arcPointsBetween(center, innerM, bA2Left, bA1Left, gapCW, steps));
  pts.push(destinationPoint(lat, lon, bA1Left, outerM));
  pts.push(...arcPointsBetween(center, outerM, bA1Left, bA1Right, true, steps));
  pts.push(destinationPoint(lat, lon, bA1Right, innerM));
  pts.push(...arcPointsBetween(center, innerM, bA1Right, bA2Right, gapCW, steps));
  return pts;
}

function arcPolygon(
  center: LatLngTuple,
  radiusM: number,
  startBearingDeg: number,
  endBearingDeg: number,
  steps = 36
): LatLngTuple[] {
  const [lat, lon] = center;
  let start = startBearingDeg;
  let end = endBearingDeg;
  if (end < start) {
    end += 360;
  }
  const span = end - start;
  const pts: LatLngTuple[] = [center];
  for (let i = 0; i <= steps; i++) {
    const b = start + (span * i) / steps;
    pts.push(destinationPoint(lat, lon, b, radiusM));
  }
  return pts;
}

function ringSectorPolygon(
  center: LatLngTuple,
  outerM: number,
  innerM: number,
  startBearingDeg: number,
  endBearingDeg: number,
  steps = 36
): LatLngTuple[] {
  const [lat, lon] = center;
  let start = startBearingDeg;
  let end = endBearingDeg;
  if (end < start) {
    end += 360;
  }
  const span = end - start;
  const outer: LatLngTuple[] = [];
  const inner: LatLngTuple[] = [];
  for (let i = 0; i <= steps; i++) {
    const b = start + (span * i) / steps;
    outer.push(destinationPoint(lat, lon, b, outerM));
    inner.push(destinationPoint(lat, lon, b, innerM));
  }
  return [...outer, ...inner.reverse()];
}

/** Secteur FAI avec trou : anneau (R1/A1) + secteur intérieur (R2/A2) si A2 ≥ 1° (XCSoar). */
export function hasFaiInnerSector(zone: ObservationZoneConfig): boolean {
  return (
    zone.r2M != null &&
    zone.r2M > 0 &&
    zone.a1Deg != null &&
    zone.a1Deg > 0 &&
    zone.a2Deg != null &&
    zone.a2Deg >= 1
  );
}

/**
 * Axe du secteur en style fixe (0) : cap opposé à A12, comme SeeYou / XCSoar (Reciprocal).
 * @see https://github.com/XCSoar/XCSoar/blob/master/src/Task/TaskFileSeeYou.cpp CalcIntermediateAngle
 */
export function cupFixedAxisBearingDeg(a12Deg: number | undefined): number {
  if (a12Deg == null || !Number.isFinite(a12Deg)) {
    return 0;
  }
  return (Math.round(a12Deg) + 180) % 360;
}

/** Cap central du secteur / ligne (° vrai, horaire depuis le nord). */
export function cupZoneReferenceBearingDeg(
  zone: ObservationZoneConfig,
  ctx: ObsZoneLegContext
): number {
  const { waypoint: wp, prev, next, departure } = ctx;
  if (zone.line) {
    if (zone.cupStyle === 3 && prev) {
      return bearingDegrees(prev.latitude, prev.longitude, wp.latitude, wp.longitude);
    }
    if (next) {
      return bearingDegrees(wp.latitude, wp.longitude, next.latitude, next.longitude);
    }
    if (prev) {
      return bearingDegrees(prev.latitude, prev.longitude, wp.latitude, wp.longitude);
    }
    return 0;
  }
  switch (zone.cupStyle) {
    case 0:
      return cupFixedAxisBearingDeg(zone.a12Deg);
    case 1:
      if (prev && next) {
        const fromPrev = bearingDegrees(
          prev.latitude,
          prev.longitude,
          wp.latitude,
          wp.longitude
        );
        const toNext = bearingDegrees(
          wp.latitude,
          wp.longitude,
          next.latitude,
          next.longitude
        );
        let diff = toNext - fromPrev;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        return (fromPrev + diff / 2 + 360) % 360;
      }
      return cupFixedAxisBearingDeg(zone.a12Deg);
    case 2:
      return next
        ? bearingDegrees(wp.latitude, wp.longitude, next.latitude, next.longitude)
        : 0;
    case 3:
      return prev
        ? bearingDegrees(prev.latitude, prev.longitude, wp.latitude, wp.longitude)
        : 0;
    case 4:
      return departure
        ? bearingDegrees(wp.latitude, wp.longitude, departure.latitude, departure.longitude)
        : 0;
    default:
      return cupFixedAxisBearingDeg(zone.a12Deg);
  }
}

export function buildObsZoneMapShapes(ctx: ObsZoneLegContext): ObsZoneMapShape[] {
  const zone = normalizeObservationZone(
    ctx.leg.obsZone ?? defaultObservationZoneForRole(ctx.leg.role, ctx.defaultRadiusM),
    ctx.leg.role,
    ctx.defaultRadiusM
  );
  const center: LatLngTuple = [ctx.waypoint.latitude, ctx.waypoint.longitude];
  const base = {
    legIndex: ctx.legIndex,
    role: ctx.leg.role,
    center,
    label: zone.line ? `Ligne ${zone.r1M} m` : `R${zone.r1M} m`
  };

  if (zone.line) {
    const brg = cupZoneReferenceBearingDeg(zone, ctx);
    const perp = (brg + 90) % 360;
    const half =
      zone.a1Deg != null && zone.a1Deg >= 170 ? zone.r1M : Math.max(zone.r1M / 2, 50);
    return [
      {
        ...base,
        kind: 'line',
        linePoints: [
          destinationPoint(center[0], center[1], perp, half),
          destinationPoint(center[0], center[1], (perp + 180) % 360, half)
        ],
        label: `Ligne ${half * 2} m`
      }
    ];
  }

  if (zone.r2M != null && zone.r2M > 0 && zone.a1Deg != null) {
    const brg = cupZoneReferenceBearingDeg(zone, ctx);
    const halfA1 = zone.a1Deg / 2;
    const bA1Left = brg - halfA1;
    const bA1Right = brg + halfA1;

    if (hasFaiInnerSector(zone)) {
      const halfA2 = zone.a2Deg! / 2;
      return [
        {
          ...base,
          kind: 'fai-keyhole',
          radiusM: zone.r1M,
          innerRadiusM: zone.r2M,
          startBearingDeg: bA1Left,
          endBearingDeg: bA1Right,
          innerStartBearingDeg: brg - halfA2,
          innerEndBearingDeg: brg + halfA2,
          label: `Secteur FAI ${zone.r1M / 1000} km`
        }
      ];
    }

    return [
      {
        ...base,
        kind: 'ring-sector',
        radiusM: zone.r1M,
        innerRadiusM: zone.r2M,
        startBearingDeg: bA1Left,
        endBearingDeg: bA1Right,
        label: `Secteur ${zone.r1M / 1000} km`
      }
    ];
  }

  if (zone.a1Deg != null && zone.a1Deg > 0 && zone.a1Deg < 360) {
    const brg = cupZoneReferenceBearingDeg(zone, ctx);
    const half = zone.a1Deg / 2;
    return [
      {
        ...base,
        kind: 'sector',
        radiusM: zone.r1M,
        startBearingDeg: brg - half,
        endBearingDeg: brg + half,
        label: `Secteur ${zone.a1Deg}° · ${zone.r1M} m`
      }
    ];
  }

  return [
    {
      ...base,
      kind: 'circle',
      radiusM: zone.r1M,
      label: `Cylindre ${zone.r1M} m`
    }
  ];
}

export function buildCircuitObsZoneShapes(
  legs: CircuitLeg[],
  waypointById: Map<string, Waypoint>,
  defaultRadiusM: number
): ObsZoneMapShape[] {
  const shapes: ObsZoneMapShape[] = [];
  let departureWp: Waypoint | null = null;
  const depLeg = legs.find(l => l.role === 'departure');
  if (depLeg) {
    departureWp = waypointById.get(depLeg.waypointId) ?? null;
  }

  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const wp = waypointById.get(leg.waypointId);
    if (!wp) continue;
    const prev = i > 0 ? waypointById.get(legs[i - 1].waypointId) ?? null : null;
    const next = i < legs.length - 1 ? waypointById.get(legs[i + 1].waypointId) ?? null : null;
    shapes.push(
      ...buildObsZoneMapShapes({
        legIndex: i,
        leg,
        waypoint: wp,
        prev,
        next,
        departure: departureWp,
        defaultRadiusM
      })
    );
  }
  return shapes;
}

/** Étend des bounds [south, west, north, east] avec une forme. */
export function extendBoundsWithShape(
  bounds: [[number, number], [number, number]] | null,
  shape: ObsZoneMapShape
): [[number, number], [number, number]] {
  const pts: LatLngTuple[] = [shape.center];
  if (shape.linePoints) {
    pts.push(...shape.linePoints);
  }
  if (
    shape.kind === 'fai-keyhole' &&
    shape.radiusM != null &&
    shape.innerRadiusM != null &&
    shape.startBearingDeg != null &&
    shape.endBearingDeg != null &&
    shape.innerStartBearingDeg != null &&
    shape.innerEndBearingDeg != null
  ) {
    pts.push(
      ...faiKeyholePolygonLatLngs(
        shape.center,
        shape.radiusM,
        shape.innerRadiusM,
        shape.innerStartBearingDeg,
        shape.innerEndBearingDeg,
        shape.startBearingDeg,
        shape.endBearingDeg,
        8
      )
    );
  } else if (shape.radiusM != null) {
    const [lat, lon] = shape.center;
    const r = shape.radiusM;
    for (const b of [0, 90, 180, 270]) {
      pts.push(destinationPoint(lat, lon, b, r));
    }
  }
  let south = bounds?.[0][0] ?? 90;
  let west = bounds?.[0][1] ?? 180;
  let north = bounds?.[1][0] ?? -90;
  let east = bounds?.[1][1] ?? -180;
  for (const [lat, lon] of pts) {
    south = Math.min(south, lat);
    north = Math.max(north, lat);
    west = Math.min(west, lon);
    east = Math.max(east, lon);
  }
  return [
    [south, west],
    [north, east]
  ];
}

export function obsZoneMapColors(role: CircuitLegRole): {
  stroke: string;
  fill: string;
} {
  switch (role) {
    case 'departure':
      return { stroke: '#16a34a', fill: '#22c55e' };
    case 'arrival':
      return { stroke: '#dc2626', fill: '#ef4444' };
    default:
      return { stroke: '#d97706', fill: '#fbbf24' };
  }
}
