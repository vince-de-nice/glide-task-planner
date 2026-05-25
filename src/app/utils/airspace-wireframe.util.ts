import type { FeatureCollection, Geometry, Position } from 'geojson';
import { MercatorCoordinate, type Map as MaplibreMap } from 'maplibre-gl';
import {
  parseAirspaceLimit,
  resolveCeilingMslM,
  type ParsedAirspaceLimit
} from './airspace-altitude.util';
import type { AirspaceVolumeProperties } from './airspace-volume-enrich.util';

import { isAreaOrGeoAirspaceZone } from './airspace-datasource-filter.util';
import { wireframeColorFromProps } from './airspace-vfr-style.util';
import { haversineKm } from './geo.util';
import { ringLngLatBounds, type WireframeLngLatBounds } from './airspace-wireframe-perf.util';

export const AIRSPACE_WIREFRAME_LAYER_ID = 'airspace-wireframe-3d';

/** Sommets max pour limites MSL (FL / AMSL) à la construction. */
const FLAT_RING_MAX_VERTICES_BUILD = 96;
/** Espacement max (km) entre sommets le long du contour pour zones AGL/GND. */
export const TERRAIN_RING_MAX_SEGMENT_KM = 0.3;
/** Plafond de sommets après densification (perf). */
export const TERRAIN_RING_MAX_VERTICES = 384;
/** Emprise > N km : pas de volume 3D (GEO France, etc.). */
const WIREFRAME_MAX_DIAGONAL_KM = 350;
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

    const rings = exteriorRings(feature.geometry);
    const color = wireframeColorFromProps(props);
    const id = String(props.id ?? props.GUId ?? i);

    for (let r = 0; r < rings.length; r++) {
      const ring = openRingVertices(rings[r]);
      if (ring.length < 3) continue;
      if (shouldSkipWireframeVolume(props, ring)) continue;

      const vertical = buildWireframeVerticalModel(props);
      if (!vertical) continue;

      const needsTerrain =
        vertical.useTerrainBase || vertical.useTerrainTop;
      const prepared = prepareAirspaceFootprintRing(ring, needsTerrain);
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
  const lower = parseAirspaceLimit(props.lower, undefined);
  const upper = parseAirspaceLimit(props.upper, undefined);

  const topM =
    resolveCeilingMslM(props.upper, props.upperM) ??
    props.extrusionTopM ??
    null;
  const useTerrainBase = limitUsesTerrain(lower);
  const useTerrainTop = limitUsesTerrain(upper);

  let baseM = props.extrusionBaseM;
  if (useTerrainBase) {
    baseM = baseM ?? 0;
  }

  if (
    topM == null ||
    baseM == null ||
    !Number.isFinite(topM) ||
    !Number.isFinite(baseM) ||
    topM - baseM < MIN_VOLUME_HEIGHT_M
  ) {
    return null;
  }

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

/**
 * Anneau utilisé pour les parois : densifié le long des arêtes afin que chaque segment
 * interroge le relief (évite les « cordes » qui ne suivent pas la trace au sol).
 */
export function ringForWireframeElevation(
  spec: Pick<AirspaceWireframeVolumeSpec, 'ring' | 'needsTerrainSampling' | 'useTerrainBase' | 'useTerrainTop'>,
  map: MaplibreMap | null
): ReadonlyArray<{ lng: number; lat: number }> {
  const sampleTerrain =
    map != null &&
    (spec.needsTerrainSampling || spec.useTerrainBase || spec.useTerrainTop);
  if (!sampleTerrain) return spec.ring;

  let ring = densifyRingVertices(spec.ring, TERRAIN_RING_MAX_SEGMENT_KM);
  if (ring.length > TERRAIN_RING_MAX_VERTICES) {
    ring = decimateRing(ring, TERRAIN_RING_MAX_VERTICES);
  }
  return ring;
}

/** Coins plancher / plafond en coordonnées Mercator (mise à jour avec le DEM). */
export function buildVolumeMercatorCorners(
  spec: AirspaceWireframeVolumeSpec,
  map: MaplibreMap | null
): VolumeMercatorCorners | null {
  const ring = ringForWireframeElevation(spec, map);
  const n = ring.length;
  if (n < 3) return null;

  const bottom: MercatorCoordinate[] = [];
  const top: MercatorCoordinate[] = [];
  const sampleTerrain =
    map != null && (spec.needsTerrainSampling || spec.useTerrainBase || spec.useTerrainTop);

  for (const p of ring) {
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

/** @deprecated Plus de couvercle horizontal : parois latérales uniquement. */
export function buildAirspaceCeilingMeshBuffers(
  specs: readonly AirspaceWireframeVolumeSpec[],
  map: MaplibreMap | null
): AirspaceWallMeshBuffers {
  const vertList: number[] = [];
  const indexList: number[] = [];
  let vertexBase = 0;

  for (const spec of specs) {
    const corners = buildVolumeMercatorCorners(spec, map);
    if (!corners || corners.top.length < 3) continue;

    const top = corners.top;
    for (const p of top) {
      pushMercator(vertList, p);
    }
    for (let i = 1; i < top.length - 1; i++) {
      indexList.push(vertexBase, vertexBase + i, vertexBase + i + 1);
    }
    vertexBase += top.length;
  }

  return {
    positions: new Float32Array(vertList),
    indices: new Uint32Array(indexList)
  };
}

function shouldSkipWireframeVolume(
  props: AirspaceVolumeProperties,
  ring: { lng: number; lat: number }[]
): boolean {
  if (isAreaOrGeoAirspaceZone(props)) return true;

  const b = ringLngLatBounds(ring);
  const diagKm = haversineKm([b.west, b.south], [b.east, b.north]);
  return diagKm > WIREFRAME_MAX_DIAGONAL_KM;
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
    segmentCount += n;
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

/** Anneau horizontal partagé trace 2D + emprise fil de fer (AGL/GND densifié). */
export function prepareAirspaceFootprintRing(
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
