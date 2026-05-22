import type { FeatureCollection, Geometry, Position } from 'geojson';
import { MercatorCoordinate, type Map as MaplibreMap } from 'maplibre-gl';
import {
  parseAirspaceLimit,
  type ParsedAirspaceLimit
} from './airspace-altitude.util';
import type { AirspaceVolumeProperties } from './airspace-volume-enrich.util';

export const AIRSPACE_WIREFRAME_LAYER_ID = 'airspace-wireframe-3d';

const MAX_RING_VERTICES = 64;
const MIN_VOLUME_HEIGHT_M = 1;

export interface AirspaceWireframeVolumeSpec {
  id: string;
  ring: ReadonlyArray<{ lng: number; lat: number }>;
  color: string;
  /** Plancher MSL constant (limites FL / FT AMSL). */
  baseM: number;
  /** Plafond MSL constant. */
  topM: number;
  /** Plancher = relief(sommet) + offset (AGL / GND). */
  useTerrainBase: boolean;
  /** Plafond = relief(sommet) + offset (AGL). */
  useTerrainTop: boolean;
  baseOffsetM: number;
  topOffsetM: number;
}

/** Specs 3D pour fil de fer (plancher + plafond + arêtes verticales). */
export function buildAirspaceWireframeSpecs(
  collection: FeatureCollection<Geometry, AirspaceVolumeProperties>
): AirspaceWireframeVolumeSpec[] {
  const specs: AirspaceWireframeVolumeSpec[] = [];

  for (let i = 0; i < collection.features.length; i++) {
    const feature = collection.features[i];
    const props = feature.properties;
    if (!props?.hasVolume) continue;

    const vertical = buildWireframeVerticalModel(props);
    if (!vertical) continue;

    const rings = exteriorRings(feature.geometry);
    const color = normalizeWireframeColor(props.stroke);
    const id = String(props.id ?? props.GUId ?? i);

    for (let r = 0; r < rings.length; r++) {
      const ring = openRingVertices(rings[r]);
      if (ring.length < 3) continue;
      specs.push({
        id: `${id}-${r}`,
        ring: decimateRing(ring, MAX_RING_VERTICES),
        color,
        ...vertical
      });
    }
  }

  return specs;
}

/** Modèle vertical : constant MSL et/ou suivi du relief par sommet. */
export function buildWireframeVerticalModel(
  props: AirspaceVolumeProperties
): Omit<AirspaceWireframeVolumeSpec, 'id' | 'ring' | 'color'> | null {
  const baseM = props.extrusionBaseM;
  const topM = props.extrusionTopM;
  if (
    baseM == null ||
    topM == null ||
    !Number.isFinite(baseM) ||
    !Number.isFinite(topM) ||
    topM - baseM < MIN_VOLUME_HEIGHT_M
  ) {
    return null;
  }

  const lower = parseAirspaceLimit(props.lower, props.lowerM);
  const upper = parseAirspaceLimit(props.upper, props.upperM);

  const useTerrainBase = limitUsesTerrain(lower);
  const useTerrainTop = limitUsesTerrain(upper);

  return {
    baseM,
    topM,
    useTerrainBase,
    useTerrainTop,
    baseOffsetM: terrainOffsetM(lower),
    topOffsetM: terrainOffsetM(upper)
  };
}

function limitUsesTerrain(limit: ParsedAirspaceLimit | null): boolean {
  return limit?.kind === 'agl' || limit?.kind === 'ground';
}

function terrainOffsetM(limit: ParsedAirspaceLimit | null): number {
  if (!limit) return 0;
  if (limit.kind === 'agl' || limit.kind === 'ground') return limit.valueM;
  return 0;
}

/** Altitude MSL au plancher pour un sommet. */
export function wireframeVertexBaseM(
  spec: Pick<
    AirspaceWireframeVolumeSpec,
    'useTerrainBase' | 'baseOffsetM' | 'baseM'
  >,
  groundM: number | null
): number {
  if (spec.useTerrainBase && groundM != null && Number.isFinite(groundM)) {
    return groundM + spec.baseOffsetM;
  }
  return spec.baseM;
}

/** Altitude MSL au plafond pour un sommet. */
export function wireframeVertexTopM(
  spec: Pick<
    AirspaceWireframeVolumeSpec,
    'useTerrainTop' | 'topOffsetM' | 'topM'
  >,
  groundM: number | null
): number {
  if (spec.useTerrainTop && groundM != null && Number.isFinite(groundM)) {
    return groundM + spec.topOffsetM;
  }
  return spec.topM;
}

/**
 * Positions pour `THREE.LineSegments` : paires de sommets (mercator x,y,z).
 * Le relief est rééchantillonné à chaque appel (carte inclinée / tuiles DEM).
 */
export function buildAirspaceWireframePositions(
  specs: readonly AirspaceWireframeVolumeSpec[],
  map: MaplibreMap | null
): Float32Array {
  let segmentCount = 0;
  for (const spec of specs) {
    const n = spec.ring.length;
    if (n < 3) continue;
    segmentCount += n * 3;
  }

  const positions = new Float32Array(segmentCount * 2 * 3);
  let offset = 0;

  for (const spec of specs) {
    offset = appendVolumeWireframe(positions, offset, spec, map);
  }

  return positions.subarray(0, offset);
}

function appendVolumeWireframe(
  buffer: Float32Array,
  offset: number,
  spec: AirspaceWireframeVolumeSpec,
  map: MaplibreMap | null
): number {
  const n = spec.ring.length;
  if (n < 3) return offset;

  const bottom: MercatorCoordinate[] = [];
  const top: MercatorCoordinate[] = [];

  for (const p of spec.ring) {
    const groundM = map?.queryTerrainElevation([p.lng, p.lat]) ?? null;
    const baseAlt = wireframeVertexBaseM(spec, groundM);
    const topAlt = wireframeVertexTopM(spec, groundM);
    const floorAlt = Math.min(baseAlt, topAlt);
    const ceilAlt = Math.max(baseAlt, topAlt);

    bottom.push(MercatorCoordinate.fromLngLat([p.lng, p.lat], floorAlt));
    top.push(MercatorCoordinate.fromLngLat([p.lng, p.lat], ceilAlt));
  }

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    offset = writeSegment(buffer, offset, bottom[i], bottom[j]);
    offset = writeSegment(buffer, offset, top[i], top[j]);
    offset = writeSegment(buffer, offset, bottom[i], top[i]);
  }

  return offset;
}

function writeSegment(
  buffer: Float32Array,
  offset: number,
  a: MercatorCoordinate,
  b: MercatorCoordinate
): number {
  buffer[offset++] = a.x;
  buffer[offset++] = a.y;
  buffer[offset++] = a.z;
  buffer[offset++] = b.x;
  buffer[offset++] = b.y;
  buffer[offset++] = b.z;
  return offset;
}

function exteriorRings(geometry: Geometry): Position[][] {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.length > 0 ? [geometry.coordinates[0]] : [];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates
      .map(poly => (poly.length > 0 ? poly[0] : null))
      .filter((ring): ring is Position[] => ring != null);
  }
  return [];
}

function openRingVertices(ring: Position[]): { lng: number; lat: number }[] {
  const pts = ring.map(p => ({ lng: p[0], lat: p[1] }));
  if (pts.length > 1) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first.lng === last.lng && first.lat === last.lat) {
      pts.pop();
    }
  }
  return pts;
}

function normalizeWireframeColor(raw?: string): string {
  const s = raw?.trim();
  if (s && /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(s)) return s;
  return '#c026d3';
}

function decimateRing<T>(pts: readonly T[], maxCount: number): T[] {
  if (pts.length <= maxCount) return [...pts];
  const step = Math.ceil(pts.length / maxCount);
  const out: T[] = [];
  for (let i = 0; i < pts.length; i += step) {
    out.push(pts[i]);
  }
  return out;
}
