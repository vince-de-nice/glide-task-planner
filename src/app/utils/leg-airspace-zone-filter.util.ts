import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { PoaffProperties } from '../services/airspace-layer.service';
import type { LegAirspaceZoneCatalogEntry } from '../models/leg-airspace-zone.model';
import type { AirspaceVolumeProperties } from './airspace-volume-enrich.util';
import {
  featureFloorCeilingMslM,
  filterAirspaceFeatureCollection,
  type AirspaceZoneFiltersPrefs
} from './airspace-zone-filter.util';
import type { LegEvolutionEnvelope } from './leg-evolution-envelope.util';

/** Clé stable pour persistance / toggles. */
export function airspaceZoneKey(
  props: PoaffProperties | AirspaceVolumeProperties | undefined,
  featureId?: string | number
): string {
  const p = props ?? {};
  const guid = (p.GUId ?? '').trim();
  if (guid) return guid;
  const id = (p.id ?? '').trim();
  if (id) return id;
  const name = (p.nameV ?? '').trim();
  if (name) return `name:${name}`;
  if (featureId != null) return `feat:${featureId}`;
  return '';
}

export function airspaceZoneDisplayName(
  props: PoaffProperties | undefined
): string {
  return (props?.nameV ?? props?.id ?? props?.GUId ?? 'Zone').trim() || 'Zone';
}

function featureLngLatBounds(
  geometry: Geometry
): { west: number; south: number; east: number; north: number } | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  const visit = (lng: number, lat: number): void => {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  };

  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates) {
      for (const [lng, lat] of ring) visit(lng, lat);
    }
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      for (const ring of poly) {
        for (const [lng, lat] of ring) visit(lng, lat);
      }
    }
  } else {
    return null;
  }

  if (!Number.isFinite(west)) return null;
  return { west, south, east, north };
}

function horizontalIntersectsEnvelope(
  geometry: Geometry,
  env: LegEvolutionEnvelope
): boolean {
  const b = featureLngLatBounds(geometry);
  if (!b) return false;
  return (
    b.west <= env.east &&
    b.east >= env.west &&
    b.south <= env.north &&
    b.north >= env.south
  );
}

function verticalIntersectsEnvelope(
  props: PoaffProperties | AirspaceVolumeProperties,
  env: LegEvolutionEnvelope
): boolean {
  const { floorM, ceilingM } = featureFloorCeilingMslM(props);
  if (floorM == null || ceilingM == null) {
    return true;
  }
  return ceilingM >= env.floorM && floorM <= env.ceilingM;
}

/** Zone POAFF dans le périmètre d'évolution de la branche. */
export function airspaceFeatureInLegEvolutionEnvelope(
  feature: Feature<Geometry, AirspaceVolumeProperties>,
  envelope: LegEvolutionEnvelope
): boolean {
  if (!horizontalIntersectsEnvelope(feature.geometry, envelope)) {
    return false;
  }
  return verticalIntersectsEnvelope(feature.properties ?? {}, envelope);
}

export function buildLegAirspaceZoneCatalog(
  collection: FeatureCollection<Geometry, AirspaceVolumeProperties>,
  envelope: LegEvolutionEnvelope
): LegAirspaceZoneCatalogEntry[] {
  const entries: LegAirspaceZoneCatalogEntry[] = [];

  for (let i = 0; i < collection.features.length; i++) {
    const f = collection.features[i];
    if (!airspaceFeatureInLegEvolutionEnvelope(f, envelope)) continue;
    const props = f.properties ?? {};
    const key = airspaceZoneKey(props, f.id ?? i);
    if (!key) continue;
    entries.push({
      key,
      name: airspaceZoneDisplayName(props),
      class: props.class,
      type: props.type,
      lower: props.lower,
      upper: props.upper
    });
  }

  entries.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return dedupeCatalogEntries(entries);
}

function dedupeCatalogEntries(
  entries: LegAirspaceZoneCatalogEntry[]
): LegAirspaceZoneCatalogEntry[] {
  const seen = new Set<string>();
  const out: LegAirspaceZoneCatalogEntry[] = [];
  for (const e of entries) {
    if (seen.has(e.key)) continue;
    seen.add(e.key);
    out.push(e);
  }
  return out;
}

export function mergeDisabledAirspaceKeys(
  catalog: readonly LegAirspaceZoneCatalogEntry[],
  prevDisabled: readonly string[] | undefined
): string[] {
  const keys = new Set(catalog.map(c => c.key));
  return (prevDisabled ?? []).filter(k => keys.has(k));
}

export function filterAirspaceCollectionForLegDisplay(
  collection: FeatureCollection<Geometry, AirspaceVolumeProperties>,
  zoneFilters: AirspaceZoneFiltersPrefs,
  enabledKeys: ReadonlySet<string>,
  catalogKeys: ReadonlySet<string>
): FeatureCollection<Geometry, AirspaceVolumeProperties> {
  const prefFiltered = filterAirspaceFeatureCollection(collection, zoneFilters);
  return {
    type: 'FeatureCollection',
    features: prefFiltered.features.filter(f => {
      const key = airspaceZoneKey(f.properties, f.id);
      return key && catalogKeys.has(key) && enabledKeys.has(key);
    })
  };
}

export function findAirspaceFeatureByKey(
  collection: FeatureCollection<Geometry, AirspaceVolumeProperties>,
  key: string
): Feature<Geometry, AirspaceVolumeProperties> | null {
  for (let i = 0; i < collection.features.length; i++) {
    const f = collection.features[i];
    if (airspaceZoneKey(f.properties, f.id ?? i) === key) return f;
  }
  return null;
}

/** Contour GeoJSON pour surbrillance au survol. */
export function airspaceFeatureToHighlightLines(
  feature: Feature<Geometry, AirspaceVolumeProperties>
): FeatureCollection<Geometry> {
  const geom = feature.geometry;
  if (geom.type === 'Polygon') {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: geom.coordinates[0]
          }
        }
      ]
    };
  }
  if (geom.type === 'MultiPolygon') {
    const features = geom.coordinates.map((poly, idx) => ({
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: poly[0]
      },
      id: idx
    }));
    return { type: 'FeatureCollection', features };
  }
  return { type: 'FeatureCollection', features: [] };
}
