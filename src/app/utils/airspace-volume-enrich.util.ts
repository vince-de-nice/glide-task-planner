import type { Feature, FeatureCollection, Geometry, Polygon } from 'geojson';
import type { Map as MaplibreMap } from 'maplibre-gl';
import type { PoaffProperties } from '../services/airspace-layer.service';
import {
  isAglLimitText,
  resolveExtrusionBounds
} from './airspace-altitude.util';

export interface AirspaceVolumeProperties extends PoaffProperties {
  extrusionBaseM?: number;
  extrusionTopM?: number;
  hasVolume?: boolean;
  verticalLabel?: string;
  needsDemGround?: boolean;
}

function ringSamplePoints(ring: number[][]): [number, number][] {
  const pts: [number, number][] = [];
  if (ring.length === 0) return pts;
  const step = Math.max(1, Math.floor(ring.length / 6));
  for (let i = 0; i < ring.length; i += step) {
    pts.push([ring[i][0], ring[i][1]]);
  }
  let sx = 0;
  let sy = 0;
  const n = Math.max(1, ring.length - 1);
  for (let i = 0; i < n; i++) {
    sx += ring[i][0];
    sy += ring[i][1];
  }
  pts.push([sx / n, sy / n]);
  return pts;
}

function geometrySamplePoints(geometry: Geometry): [number, number][] {
  if (geometry.type === 'Polygon') {
    return ringSamplePoints(geometry.coordinates[0]);
  }
  if (geometry.type === 'MultiPolygon') {
    let best: number[][] = [];
    for (const poly of geometry.coordinates) {
      const ring = poly[0];
      if (ring.length > best.length) best = ring;
    }
    return ringSamplePoints(best);
  }
  return [];
}

/** Relief minimal (m MSL) sous le polygone via DEM MapLibre. */
export function samplePolygonMinGroundElevationM(
  map: MaplibreMap,
  geometry: Geometry
): number | null {
  const points = geometrySamplePoints(geometry);
  let min: number | null = null;
  for (const [lng, lat] of points) {
    const elev = map.queryTerrainElevation([lng, lat]);
    if (elev == null || !Number.isFinite(elev)) continue;
    min = min == null ? elev : Math.min(min, elev);
  }
  return min;
}

function featureNeedsDemGround(props: PoaffProperties): boolean {
  const lower = (props.lower ?? '').toUpperCase();
  const upper = (props.upper ?? '').toUpperCase();
  return (
    isAglLimitText(props.lower) ||
    isAglLimitText(props.upper) ||
    lower === 'GND' ||
    lower === 'SFC' ||
    lower === 'GROUND' ||
    upper === 'GND'
  );
}

/**
 * Enrichit chaque feature POAFF avec les propriétés d'extrusion 3D.
 * Tous les types présents dans les données sont conservés.
 */
export function enrichAirspaceFeatureProperties(
  feature: Feature<Geometry, PoaffProperties>,
  groundM: number | null
): Feature<Geometry, AirspaceVolumeProperties> {
  const props = feature.properties ?? {};
  const bounds = resolveExtrusionBounds(
    props.lower,
    props.upper,
    props.lowerM,
    props.upperM,
    groundM
  );

  const enriched: AirspaceVolumeProperties = {
    ...props,
    needsDemGround: featureNeedsDemGround(props),
    verticalLabel: bounds?.verticalLabel ?? [props.lower, props.upper].filter(Boolean).join(' → ')
  };

  if (bounds?.hasVolume) {
    enriched.extrusionBaseM = bounds.extrusionBaseM;
    enriched.extrusionTopM = bounds.extrusionTopM;
    enriched.hasVolume = true;
  } else {
    enriched.hasVolume = false;
  }

  return {
    type: 'Feature',
    geometry: feature.geometry,
    properties: enriched
  };
}

export function enrichAirspaceCollection(
  collection: FeatureCollection<Geometry, PoaffProperties>,
  groundByFeatureId: ReadonlyMap<string, number>
): FeatureCollection<Geometry, AirspaceVolumeProperties> {
  return {
    type: 'FeatureCollection',
    features: collection.features.map(f => {
      const id = f.properties?.id ?? f.properties?.GUId ?? '';
      const groundM = id ? (groundByFeatureId.get(String(id)) ?? null) : null;
      return enrichAirspaceFeatureProperties(f, groundM);
    })
  };
}

/**
 * Échantillonne le DEM pour les zones AGL / GND et retourne une collection enrichie.
 */
export async function enrichAirspaceCollectionWithDem(
  map: MaplibreMap,
  collection: FeatureCollection<Geometry, PoaffProperties>,
  options: { chunkSize?: number } = {}
): Promise<FeatureCollection<Geometry, AirspaceVolumeProperties>> {
  const chunk = options.chunkSize ?? 40;
  const groundById = new Map<string, number>();

  for (let i = 0; i < collection.features.length; i++) {
    const f = collection.features[i];
    const props = f.properties ?? {};
    if (!featureNeedsDemGround(props) && props.lower?.toUpperCase() !== 'GND') {
      continue;
    }
    const key = String(props.id ?? props.GUId ?? i);
    const groundM = samplePolygonMinGroundElevationM(map, f.geometry);
    if (groundM != null) {
      groundById.set(key, groundM);
    }
    if (i > 0 && i % chunk === 0) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
  }

  return enrichAirspaceCollection(collection, groundById);
}
