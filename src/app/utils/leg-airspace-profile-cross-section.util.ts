import type { FeatureCollection, Geometry } from 'geojson';
import type { AirspaceVolumeProperties } from './airspace-volume-enrich.util';
import { interpolateGreatCircle, toRad } from './geo.util';
import { featureFloorCeilingMslM } from './airspace-zone-filter.util';
import { airspaceZoneKey, airspaceZoneDisplayName } from './leg-airspace-zone-filter.util';

export interface LegAirspaceProfileLeg {
  fromLng: number;
  fromLat: number;
  toLng: number;
  toLat: number;
  legLengthKm: number;
  /** Étendue affichée sur la coupe (km le long de la branche). */
  profileStartKm: number;
  profileEndKm: number;
}

/**
 * Bande d'espace aérien sur la coupe verticale (intersection zone × branche).
 *
 * - `floorM` / `ceilingM` : bornes réglementaires MSL (données zone).
 * - `displayFloorM` / `displayCeilingM` : tracé sur la coupe après plafonnement
 *   à l'enveloppe de vol (altitude mini + marge) — voir `applyAirspaceProfileDisplayLimits`.
 */
export interface LegAirspaceProfileBand {
  key: string;
  name: string;
  alongStartKm: number;
  alongEndKm: number;
  /** Plancher réglementaire MSL. */
  floorM: number;
  /** Plafond réglementaire MSL. */
  ceilingM: number;
  /** Plancher tracé (souvent identique au réglementaire). */
  displayFloorM: number;
  /** Plafond tracé (≤ plafond réglementaire). */
  displayCeilingM: number;
  /** Vrai si le plafond réglementaire dépasse la partie affichée. */
  ceilingTruncated: boolean;
  /** Couleur de remplissage (hex ou rgba). */
  fill: string;
}

/** Bande horizontale avant plafonnement à l'enveloppe de vol (calcul d'affichage). */
export type LegAirspaceProfileBandRaw = Pick<
  LegAirspaceProfileBand,
  'key' | 'name' | 'alongStartKm' | 'alongEndKm' | 'floorM' | 'ceilingM' | 'fill'
>;

const ALONG_EPS_KM = 1e-4;

/** Intersections horizontales zone × branche (plancher/plafond réglementaires bruts). */
export function computeLegAirspaceProfileBands(
  leg: LegAirspaceProfileLeg,
  collection: FeatureCollection<Geometry, AirspaceVolumeProperties>,
  enabledKeys: ReadonlySet<string>
): LegAirspaceProfileBandRaw[] {
  if (enabledKeys.size === 0 || leg.legLengthKm <= 0) return [];

  const clipStart = Math.max(0, Math.min(leg.profileStartKm, leg.profileEndKm));
  const clipEnd = Math.max(clipStart, leg.profileEndKm);
  const from: [number, number] = [leg.fromLng, leg.fromLat];
  const to: [number, number] = [leg.toLng, leg.toLat];
  const projector = buildLegProjector(from, to, leg.legLengthKm);

  const bands: LegAirspaceProfileBandRaw[] = [];

  for (let i = 0; i < collection.features.length; i++) {
    const feature = collection.features[i];
    const props = feature.properties ?? {};
    const key = airspaceZoneKey(props, feature.id ?? i);
    if (!key || !enabledKeys.has(key)) continue;

    const { floorM, ceilingM } = featureFloorCeilingMslM(props);
    if (floorM == null || ceilingM == null) continue;

    const ranges = horizontalRangesAlongLeg(
      feature.geometry,
      from,
      to,
      leg.legLengthKm,
      projector
    );
    for (const range of ranges) {
      const start = Math.max(clipStart, range.startKm);
      const end = Math.min(clipEnd, range.endKm);
      if (end - start < ALONG_EPS_KM) continue;
      bands.push({
        key,
        name: airspaceZoneDisplayName(props),
        alongStartKm: start,
        alongEndKm: end,
        floorM: Math.min(floorM, ceilingM),
        ceilingM: Math.max(floorM, ceilingM),
        fill: airspaceProfileFillColor(props, key)
      });
    }
  }

  bands.sort((a, b) => a.alongStartKm - b.alongStartKm || a.floorM - b.floorM);
  return bands;
}

function airspaceProfileFillColor(
  props: AirspaceVolumeProperties,
  key: string
): string {
  const raw = (props.fill ?? '').trim();
  if (raw && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
    return hexWithAlpha(raw, 0.22);
  }
  return hashFillColor(key);
}

function hashFillColor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `hsla(${hue}, 55%, 48%, 0.28)`;
}

function hexWithAlpha(hex: string, alpha: number): string {
  const norm = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;
  const r = parseInt(norm.slice(1, 3), 16);
  const g = parseInt(norm.slice(3, 5), 16);
  const b = parseInt(norm.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface AlongRange {
  startKm: number;
  endKm: number;
}

interface LegProjector {
  toLocal(lng: number, lat: number): { x: number; y: number };
  legLine: { x1: number; y1: number; x2: number; y2: number };
}

function buildLegProjector(
  from: [number, number],
  to: [number, number],
  legLengthKm: number
): LegProjector {
  const midLat = (from[1] + to[1]) / 2;
  const cosLat = Math.cos(toRad(midLat));
  const kmPerDegLng = 111.32 * cosLat;
  const kmPerDegLat = 111.32;

  const fromXY = { x: 0, y: 0 };
  const toXY = {
    x: (to[0] - from[0]) * kmPerDegLng,
    y: (to[1] - from[1]) * kmPerDegLat
  };

  return {
    legLine: { x1: fromXY.x, y1: fromXY.y, x2: toXY.x, y2: toXY.y },
    toLocal(lng: number, lat: number) {
      return {
        x: (lng - from[0]) * kmPerDegLng,
        y: (lat - from[1]) * kmPerDegLat
      };
    }
  };
}

function horizontalRangesAlongLeg(
  geometry: Geometry,
  from: [number, number],
  to: [number, number],
  legLengthKm: number,
  projector: LegProjector
): AlongRange[] {
  const rings = outerRings(geometry);
  if (rings.length === 0) return [];

  const breakpoints = new Set<number>([0, legLengthKm]);

  for (const ring of rings) {
    const n = ring.length;
    if (n < 2) continue;
    for (let i = 0; i < n - 1; i++) {
      const a = ring[i];
      const b = ring[i + 1];
      const pa = projector.toLocal(a[0], a[1]);
      const pb = projector.toLocal(b[0], b[1]);
      const hits = segmentSegmentIntersection(
        projector.legLine.x1,
        projector.legLine.y1,
        projector.legLine.x2,
        projector.legLine.y2,
        pa.x,
        pa.y,
        pb.x,
        pb.y
      );
      for (const t of hits) {
        const km = t * legLengthKm;
        if (km >= -ALONG_EPS_KM && km <= legLengthKm + ALONG_EPS_KM) {
          breakpoints.add(clampAlong(km, legLengthKm));
        }
      }
    }
  }

  const fromInside = rings.some(ring =>
    pointInRing(projector.toLocal(from[0], from[1]), ring, projector)
  );
  const toInside = rings.some(ring =>
    pointInRing(projector.toLocal(to[0], to[1]), ring, projector)
  );
  if (fromInside) breakpoints.add(0);
  if (toInside) breakpoints.add(legLengthKm);

  const sorted = [...breakpoints].sort((a, b) => a - b);
  const ranges: AlongRange[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const startKm = sorted[i];
    const endKm = sorted[i + 1];
    if (endKm - startKm < ALONG_EPS_KM) continue;
    const midT = (startKm + endKm) / (2 * legLengthKm);
    const [lng, lat] = interpolateGreatCircle(from, to, midT);
    const p = projector.toLocal(lng, lat);
    const inside = rings.some(ring => pointInRing(p, ring, projector));
    if (inside) {
      ranges.push({ startKm, endKm });
    }
  }

  return mergeAlongRanges(ranges);
}

function outerRings(geometry: Geometry): number[][][] {
  if (geometry.type === 'Polygon') {
    return [geometry.coordinates[0]];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map(poly => poly[0]);
  }
  return [];
}

function clampAlong(km: number, legLengthKm: number): number {
  return Math.max(0, Math.min(legLengthKm, km));
}

function mergeAlongRanges(ranges: AlongRange[]): AlongRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.startKm - b.startKm);
  const out: AlongRange[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const prev = out[out.length - 1];
    const cur = sorted[i];
    if (cur.startKm <= prev.endKm + ALONG_EPS_KM) {
      prev.endKm = Math.max(prev.endKm, cur.endKm);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

function segmentSegmentIntersection(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number
): number[] {
  const d1x = x2 - x1;
  const d1y = y2 - y1;
  const d2x = x4 - x3;
  const d2y = y4 - y3;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-12) return [];

  const t =
    ((x3 - x1) * d2y - (y3 - y1) * d2x) / denom;
  const u =
    ((x3 - x1) * d1y - (y3 - y1) * d1x) / denom;
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) {
    return [];
  }
  return [t];
}

function pointInRing(
  p: { x: number; y: number },
  ring: number[][],
  projector: LegProjector
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const pi = projector.toLocal(ring[i][0], ring[i][1]);
    const pj = projector.toLocal(ring[j][0], ring[j][1]);
    const intersect =
      pi.y > p.y !== pj.y > p.y &&
      p.x <
        ((pj.x - pi.x) * (p.y - pi.y)) / (pj.y - pi.y + Number.EPSILON) + pi.x;
    if (intersect) inside = !inside;
  }
  return inside;
}
