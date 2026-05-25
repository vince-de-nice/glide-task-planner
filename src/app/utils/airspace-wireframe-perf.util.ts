import type { Geometry } from 'geojson';
import type { Map as MaplibreMap } from 'maplibre-gl';
import type { AirspaceWireframeVolumeSpec } from './airspace-wireframe.util';

export interface WireframeLngLatBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * `false` = toutes les zones chargées, pas de sync GeoJSON au pan (carte circuit).
 * Le fil de fer ne rebuild plus au zoom ; culling viewport optionnel si `true`.
 */
export const AIRSPACE_VIEWPORT_CULLING_ENABLED = false;

/** Marge autour du viewport pour inclure les zones qui effleurent le bord. */
const VIEW_BOUNDS_PAD_RATIO = 0.02;

/** Sommets max par anneau (limites MSL) selon le zoom. */
export function maxRingVerticesForZoom(zoom: number): number {
  if (zoom < 8) return 8;
  if (zoom < 10) return 12;
  if (zoom < 12) return 18;
  if (zoom < 14) return 24;
  return 32;
}

/** Sommets max pour zones AGL/GND (déjà densifiées — décimation légère). */
export function maxRingVerticesForTerrainZoom(zoom: number): number {
  if (zoom < 9) return 64;
  if (zoom < 11) return 120;
  if (zoom < 13) return 180;
  return 220;
}

export function ringLngLatBounds(
  ring: ReadonlyArray<{ lng: number; lat: number }>
): WireframeLngLatBounds {
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const p of ring) {
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
  }
  return { west, south, east, north };
}

function boundsIntersect(
  a: WireframeLngLatBounds,
  view: WireframeLngLatBounds
): boolean {
  return a.west <= view.east && a.east >= view.west && a.south <= view.north && a.north >= view.south;
}

function expandViewBounds(
  view: WireframeLngLatBounds,
  padRatio: number
): WireframeLngLatBounds {
  const lngPad = (view.east - view.west) * padRatio;
  const latPad = (view.north - view.south) * padRatio;
  return {
    west: view.west - lngPad,
    east: view.east + lngPad,
    south: view.south - latPad,
    north: view.north + latPad
  };
}

function decimateRingForZoom<T>(
  ring: readonly T[],
  maxVertices: number
): readonly T[] {
  if (ring.length <= maxVertices) return ring;
  const step = Math.ceil(ring.length / maxVertices);
  const out: T[] = [];
  for (let i = 0; i < ring.length; i += step) {
    out.push(ring[i]);
  }
  return out;
}

export function mapViewBounds(map: MaplibreMap): WireframeLngLatBounds {
  const b = map.getBounds();
  return expandViewBounds(
    {
      west: b.getWest(),
      south: b.getSouth(),
      east: b.getEast(),
      north: b.getNorth()
    },
    VIEW_BOUNDS_PAD_RATIO
  );
}

/**
 * Tous les volumes dont l’emprise intersecte la vue (sans plafond ni tri par taille).
 */
export function filterWireframeSpecsForViewport(
  specs: readonly AirspaceWireframeVolumeSpec[],
  map: MaplibreMap
): AirspaceWireframeVolumeSpec[] {
  if (!AIRSPACE_VIEWPORT_CULLING_ENABLED) {
    return specs.filter(s => s.ring.length >= 3);
  }

  const view = mapViewBounds(map);
  const zoom = map.getZoom();
  const inView: AirspaceWireframeVolumeSpec[] = [];

  for (const spec of specs) {
    if (!boundsIntersect(spec.bounds, view)) continue;
    // Zones AGL/GND : anneau déjà densifié à la construction — ne pas ré-decimer au zoom
    // (sinon parois en cordes droites ≠ trace au sol MapLibre).
    if (spec.needsTerrainSampling) {
      if (spec.ring.length >= 3) inView.push(spec);
      continue;
    }
    const maxVerts = maxRingVerticesForZoom(zoom);
    const ring = decimateRingForZoom(spec.ring, maxVerts);
    if (ring.length < 3) continue;
    inView.push(ring === spec.ring ? spec : { ...spec, ring });
  }

  return inView;
}

function geometryBounds(geometry: Geometry): WireframeLngLatBounds | null {
  const rings: number[][][] = [];
  if (geometry.type === 'Polygon') {
    if (geometry.coordinates[0]) rings.push(geometry.coordinates[0]);
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      if (poly[0]) rings.push(poly[0]);
    }
  }
  if (rings.length === 0) return null;

  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const ring of rings) {
    for (const c of ring) {
      west = Math.min(west, c[0]);
      east = Math.max(east, c[0]);
      south = Math.min(south, c[1]);
      north = Math.max(north, c[1]);
    }
  }
  return { west, south, east, north };
}

/** Toutes les features POAFF dont la géométrie intersecte la vue. */
export function filterAirspaceFeaturesForViewport<T extends { geometry: Geometry }>(
  features: readonly T[],
  map: MaplibreMap
): T[] {
  if (!AIRSPACE_VIEWPORT_CULLING_ENABLED) {
    return [...features];
  }

  const view = mapViewBounds(map);
  const inView: T[] = [];

  for (const feature of features) {
    const bounds = geometryBounds(feature.geometry);
    if (!bounds || !boundsIntersect(bounds, view)) continue;
    inView.push(feature);
  }

  return inView;
}
