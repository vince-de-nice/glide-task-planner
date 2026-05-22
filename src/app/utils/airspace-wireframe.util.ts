import type { FeatureCollection, Geometry, Position } from 'geojson';
import { MercatorCoordinate, type Map as MaplibreMap } from 'maplibre-gl';
import {
  parseAirspaceLimit,
  type ParsedAirspaceLimit
} from './airspace-altitude.util';
import type { AirspaceVolumeProperties } from './airspace-volume-enrich.util';

import { haversineKm } from './geo.util';
import { ringLngLatBounds, type WireframeLngLatBounds } from './airspace-wireframe-perf.util';

export const AIRSPACE_WIREFRAME_LAYER_ID = 'airspace-wireframe-3d';

/** Sommets max pour limites MSL (FL / AMSL) à la construction. */
const FLAT_RING_MAX_VERTICES_BUILD = 32;
/** Espacement max (km) entre sommets le long du contour pour zones AGL/GND. */
export const TERRAIN_RING_MAX_SEGMENT_KM = 0.6;
/** Plafond de sommets après densification (perf). */
export const TERRAIN_RING_MAX_VERTICES = 220;
const MIN_VOLUME_HEIGHT_M = 1;

export interface AirspaceWireframeVolumeSpec {
  id: string;
  ring: ReadonlyArray<{ lng: number; lat: number }>;
  bounds: WireframeLngLatBounds;
  color: string;
  /** Au moins une limite suit le relief (DEM au repos de la carte). */
  needsTerrainSampling: boolean;
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
      const needsTerrain =
        vertical.useTerrainBase || vertical.useTerrainTop;
      const prepared = prepareRingVertices(ring, needsTerrain);
      specs.push({
        id: `${id}-${r}`,
        ring: prepared,
        bounds: ringLngLatBounds(prepared),
        color,
        ...vertical,
        needsTerrainSampling: vertical.useTerrainBase || vertical.useTerrainTop
      });
    }
  }

  return specs;
}

export interface WireframeVerticalModel {
  baseM: number;
  topM: number;
  useTerrainBase: boolean;
  useTerrainTop: boolean;
  baseOffsetM: number;
  topOffsetM: number;
}

/** Modèle vertical : constant MSL et/ou suivi du relief par sommet. */
export function buildWireframeVerticalModel(
  props: AirspaceVolumeProperties
): WireframeVerticalModel | null {
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

export interface VolumeMercatorCorners {
  bottom: MercatorCoordinate[];
  top: MercatorCoordinate[];
}

/** Coins plancher / plafond en coordonnées Mercator (mise à jour avec le DEM). */
export function buildVolumeMercatorCorners(
  spec: AirspaceWireframeVolumeSpec,
  map: MaplibreMap | null
): VolumeMercatorCorners | null {
  const n = spec.ring.length;
  if (n < 3) return null;

  const bottom: MercatorCoordinate[] = [];
  const top: MercatorCoordinate[] = [];
  const sampleTerrain =
    map != null && (spec.needsTerrainSampling || spec.useTerrainBase || spec.useTerrainTop);

  for (const p of spec.ring) {
    const groundM = sampleTerrain
      ? (map.queryTerrainElevation([p.lng, p.lat]) ?? null)
      : null;
    const baseAlt = wireframeVertexBaseM(spec, groundM);
    const topAlt = wireframeVertexTopM(spec, groundM);
    const floorAlt = Math.min(baseAlt, topAlt);
    const ceilAlt = Math.max(baseAlt, topAlt);

    bottom.push(MercatorCoordinate.fromLngLat([p.lng, p.lat], floorAlt));
    top.push(MercatorCoordinate.fromLngLat([p.lng, p.lat], ceilAlt));
  }

  return { bottom, top };
}

export interface AirspaceWallMeshBuffers {
  positions: Float32Array;
  indices: Uint32Array;
}

/** Plans verticaux (parois) entre plancher et plafond — 2 triangles par arête du polygone. */
export function buildAirspaceWallMeshBuffers(
  specs: readonly AirspaceWireframeVolumeSpec[],
  map: MaplibreMap | null
): AirspaceWallMeshBuffers {
  const vertList: number[] = [];
  const indexList: number[] = [];
  let vertexBase = 0;

  for (const spec of specs) {
    const corners = buildVolumeMercatorCorners(spec, map);
    if (!corners) continue;
    const n = corners.bottom.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      pushMercator(vertList, corners.bottom[i]);
      pushMercator(vertList, corners.bottom[j]);
      pushMercator(vertList, corners.top[j]);
      pushMercator(vertList, corners.top[i]);
      indexList.push(
        vertexBase,
        vertexBase + 1,
        vertexBase + 2,
        vertexBase,
        vertexBase + 2,
        vertexBase + 3
      );
      vertexBase += 4;
    }
  }

  return {
    positions: new Float32Array(vertList),
    indices: new Uint32Array(indexList)
  };
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
  const corners = buildVolumeMercatorCorners(spec, map);
  if (!corners) return offset;

  const n = corners.bottom.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    offset = writeSegment(buffer, offset, corners.bottom[i], corners.bottom[j]);
    offset = writeSegment(buffer, offset, corners.top[i], corners.top[j]);
    offset = writeSegment(buffer, offset, corners.bottom[i], corners.top[i]);
  }

  return offset;
}

function pushMercator(list: number[], mc: MercatorCoordinate): void {
  list.push(mc.x, mc.y, mc.z);
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

/**
 * Insère des sommets le long de chaque arête pour pouvoir épouser le relief (AGL).
 */
export function densifyRingVertices(
  ring: readonly { lng: number; lat: number }[],
  maxSegmentLengthKm: number
): { lng: number; lat: number }[] {
  if (ring.length < 2 || maxSegmentLengthKm <= 0) return [...ring];

  const out: { lng: number; lat: number }[] = [];
  const n = ring.length;

  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    out.push(a);

    const distKm = haversineKm([a.lng, a.lat], [b.lng, b.lat]);
    const steps = Math.max(1, Math.ceil(distKm / maxSegmentLengthKm));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      out.push({
        lng: a.lng + (b.lng - a.lng) * t,
        lat: a.lat + (b.lat - a.lat) * t
      });
    }
  }

  return out;
}

function prepareRingVertices(
  ring: { lng: number; lat: number }[],
  needsTerrain: boolean
): { lng: number; lat: number }[] {
  if (!needsTerrain) {
    return decimateRing(ring, FLAT_RING_MAX_VERTICES_BUILD);
  }

  let dense = densifyRingVertices(ring, TERRAIN_RING_MAX_SEGMENT_KM);
  if (dense.length > TERRAIN_RING_MAX_VERTICES) {
    dense = decimateRing(dense, TERRAIN_RING_MAX_VERTICES);
  }
  return dense;
}
