import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Map as MaplibreMap } from 'maplibre-gl';
import type { PoaffProperties } from '../services/airspace-layer.service';
import {
  isAglLimitText,
  resolveExtrusionBounds
} from './airspace-altitude.util';
import {
  fillTerrariumElevations,
  type TerrainElevationSample,
  type TerrariumFillProgress
} from './terrain-dem-tile.util';

export interface AirspaceVolumeProperties extends PoaffProperties {
  extrusionBaseM?: number;
  extrusionTopM?: number;
  hasVolume?: boolean;
  verticalLabel?: string;
  needsDemGround?: boolean;
  /** Relief minimal Terrarium (m MSL) sous le polygone. */
  sampledGroundM?: number;
}

export interface AirspaceTerrariumEnrichProgress {
  phase: 'prepare' | 'tiles' | 'enrich';
  percent: number;
  totalZones: number;
  processedZones: number;
  loadedTiles: number;
  totalTiles: number;
}

export type AirspaceTerrariumEnrichProgressFn = (
  progress: AirspaceTerrariumEnrichProgress
) => void;

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

/** Zone dont le plancher ou le plafond dépend du relief (AGL, GND, SFC…). */
export function featureNeedsDemGround(props: PoaffProperties): boolean {
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
    verticalLabel: bounds?.verticalLabel ?? [props.lower, props.upper].filter(Boolean).join(' → '),
    sampledGroundM: groundM ?? undefined
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
    features: collection.features.map((f, i) => {
      const id = airspaceFeatureKey(f.properties ?? undefined, i);
      const groundM = groundByFeatureId.get(id) ?? null;
      return enrichAirspaceFeatureProperties(f, groundM);
    })
  };
}

export function airspaceFeatureKey(
  props: PoaffProperties | undefined,
  index: number
): string {
  return String(props?.id ?? props?.GUId ?? index);
}

function terrariumCoordKey(longitude: number, latitude: number): string {
  return `${longitude.toFixed(6)},${latitude.toFixed(6)}`;
}

/**
 * Échantillonne le relief Terrarium (Mapterhorn) uniquement pour les zones
 * AGL / GND / SFC, puis enrichit toute la collection.
 */
export async function enrichAirspaceCollectionWithTerrarium(
  collection: FeatureCollection<Geometry, PoaffProperties>,
  options: {
    onProgress?: AirspaceTerrariumEnrichProgressFn;
  } = {}
): Promise<FeatureCollection<Geometry, AirspaceVolumeProperties>> {
  const demZoneIndices: number[] = [];
  for (let i = 0; i < collection.features.length; i++) {
    const props = collection.features[i].properties ?? {};
    if (featureNeedsDemGround(props)) {
      demZoneIndices.push(i);
    }
  }
  const demZoneCount = demZoneIndices.length;
  const report = (partial: Partial<AirspaceTerrariumEnrichProgress>): void => {
    options.onProgress?.({
      totalZones: demZoneCount,
      processedZones: 0,
      loadedTiles: 0,
      totalTiles: 0,
      percent: 0,
      phase: 'prepare',
      ...partial
    });
  };

  report({ phase: 'prepare', percent: 2, processedZones: 0 });

  const featurePointKeys: { featureKey: string; coordKeys: string[] }[] = [];
  const elevationByCoord = new Map<string, number>();
  const uniqueSamples: TerrainElevationSample[] = [];
  const coordToSample = new Map<string, TerrainElevationSample>();

  if (demZoneCount === 0) {
    report({ phase: 'enrich', percent: 100, processedZones: 0 });
    return enrichAirspaceCollection(collection, new Map());
  }

  let prepareDone = 0;
  for (const i of demZoneIndices) {
    const f = collection.features[i];
    const featureKey = airspaceFeatureKey(f.properties ?? undefined, i);
    const coordKeys: string[] = [];

    for (const [lng, lat] of geometrySamplePoints(f.geometry)) {
      const ck = terrariumCoordKey(lng, lat);
      coordKeys.push(ck);
      if (!coordToSample.has(ck)) {
        const sample: TerrainElevationSample = {
          longitude: lng,
          latitude: lat,
          elevationM: null
        };
        coordToSample.set(ck, sample);
        uniqueSamples.push(sample);
      }
    }

    featurePointKeys.push({ featureKey, coordKeys });
    prepareDone++;
    if (prepareDone % 200 === 0) {
      report({
        phase: 'prepare',
        percent: 2 + Math.round((prepareDone / demZoneCount) * 8),
        processedZones: prepareDone
      });
      await yieldToUi();
    }
  }

  report({ phase: 'prepare', percent: 10, processedZones: demZoneCount });

  await fillTerrariumElevations(uniqueSamples, undefined, (p: TerrariumFillProgress) => {
    const tilePct = 10 + Math.round((p.loadedTiles / Math.max(1, p.totalTiles)) * 82);
    report({
      phase: 'tiles',
      percent: tilePct,
      loadedTiles: p.loadedTiles,
      totalTiles: p.totalTiles,
      processedZones: demZoneCount
    });
  });

  for (const sample of uniqueSamples) {
    if (sample.elevationM == null || !Number.isFinite(sample.elevationM)) continue;
    elevationByCoord.set(
      terrariumCoordKey(sample.longitude, sample.latitude),
      sample.elevationM
    );
  }

  const groundById = new Map<string, number>();
  for (let i = 0; i < featurePointKeys.length; i++) {
    const { featureKey, coordKeys } = featurePointKeys[i];
    let min: number | null = null;
    for (const ck of coordKeys) {
      const elev = elevationByCoord.get(ck);
      if (elev == null || !Number.isFinite(elev)) continue;
      min = min == null ? elev : Math.min(min, elev);
    }
    if (min != null) {
      groundById.set(featureKey, min);
    }
    if (i > 0 && i % 250 === 0) {
      report({
        phase: 'enrich',
        percent: 92 + Math.round((i / featurePointKeys.length) * 8),
        processedZones: i,
        loadedTiles: uniqueSamples.length > 0 ? 1 : 0,
        totalTiles: 1
      });
      await yieldToUi();
    }
  }

  report({
    phase: 'enrich',
    percent: 100,
    processedZones: demZoneCount,
    loadedTiles: 1,
    totalTiles: 1
  });

  return enrichAirspaceCollection(collection, groundById);
}

function yieldToUi(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

/**
 * @deprecated Préférer {@link enrichAirspaceCollectionWithTerrarium}.
 * Échantillonne le DEM MapLibre pour les zones AGL / GND uniquement.
 */
export async function enrichAirspaceCollectionWithDem(
  map: MaplibreMap,
  collection: FeatureCollection<Geometry, PoaffProperties>,
  options: { chunkSize?: number } = {}
): Promise<FeatureCollection<Geometry, AirspaceVolumeProperties>> {
  const chunk = options.chunkSize ?? 120;
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
