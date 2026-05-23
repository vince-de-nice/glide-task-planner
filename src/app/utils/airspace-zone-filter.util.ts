import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { PoaffProperties } from '../services/airspace-layer.service';
import {
  formatMetersDisplay,
  resolveExtrusionBounds
} from './airspace-altitude.util';
import type { AirspaceVolumeProperties } from './airspace-volume-enrich.util';

export type AirspaceFilterMode = 'include' | 'exclude';

export type AirspaceVolumeDisplayFilter = 'all' | 'volumetric' | 'flat';

/** Pas des curseurs d’altitude (m MSL). */
export const AIRSPACE_ALT_FILTER_STEP_M = 100;

const ALT_FILTER_FALLBACK_MAX_M = 20_000;

export interface AirspaceCriterionFilterPrefs {
  mode: AirspaceFilterMode;
  values: string[];
}

export interface AirspaceAltitudeBandFilterPrefs {
  /** Faux = ne pas filtrer sur ce critère (min/max ignorés). */
  active: boolean;
  minM: number;
  maxM: number;
}

export interface AirspaceZoneFiltersPrefs {
  class: AirspaceCriterionFilterPrefs;
  type: AirspaceCriterionFilterPrefs;
  name: AirspaceCriterionFilterPrefs;
  volume: AirspaceVolumeDisplayFilter;
  /** Plancher des zones (m MSL). */
  floorMsl: AirspaceAltitudeBandFilterPrefs;
  /** Plafond des zones (m MSL). */
  ceilingMsl: AirspaceAltitudeBandFilterPrefs;
}

export interface AirspaceFilterAltitudeExtents {
  floorMinM: number;
  floorMaxM: number;
  ceilingMinM: number;
  ceilingMaxM: number;
  /** Zones sans altitude résolue (hors curseurs si filtre actif). */
  unknownCount: number;
}

export interface AirspaceFilterFieldOptions {
  class: string[];
  type: string[];
  altitude: AirspaceFilterAltitudeExtents | null;
}

const EMPTY_CRITERION: AirspaceCriterionFilterPrefs = { mode: 'include', values: [] };

export const INACTIVE_ALTITUDE_BAND: AirspaceAltitudeBandFilterPrefs = {
  active: false,
  minM: 0,
  maxM: ALT_FILTER_FALLBACK_MAX_M
};

export const DEFAULT_AIRSPACE_ZONE_FILTERS: AirspaceZoneFiltersPrefs = {
  class: { mode: 'include', values: [] },
  type: { mode: 'include', values: [] },
  name: { mode: 'include', values: [] },
  volume: 'all',
  floorMsl: { ...INACTIVE_ALTITUDE_BAND },
  ceilingMsl: { ...INACTIVE_ALTITUDE_BAND }
};

function normText(value: string | undefined): string {
  return (value ?? '').trim().toUpperCase();
}

function normCriterionFilter(
  raw: Partial<AirspaceCriterionFilterPrefs> | undefined
): AirspaceCriterionFilterPrefs {
  if (!raw) return { ...EMPTY_CRITERION };
  const mode = raw.mode === 'exclude' ? 'exclude' : 'include';
  const values = Array.isArray(raw.values)
    ? [...new Set(raw.values.map(v => String(v).trim()).filter(Boolean))]
    : [];
  return { mode, values };
}

function normAltitudeBand(
  raw: Partial<AirspaceAltitudeBandFilterPrefs> | undefined,
  fallback: AirspaceAltitudeBandFilterPrefs
): AirspaceAltitudeBandFilterPrefs {
  if (!raw) return { ...fallback };
  const minM = Number.isFinite(raw.minM) ? (raw.minM as number) : fallback.minM;
  const maxM = Number.isFinite(raw.maxM) ? (raw.maxM as number) : fallback.maxM;
  const lo = Math.min(minM, maxM);
  const hi = Math.max(minM, maxM);
  return {
    active: raw.active === true,
    minM: lo,
    maxM: hi
  };
}

/** @deprecated Anciens critères texte — ignorés à la normalisation. */
interface LegacyAirspaceZoneFiltersPrefs extends Partial<AirspaceZoneFiltersPrefs> {
  lower?: AirspaceCriterionFilterPrefs;
  upper?: AirspaceCriterionFilterPrefs;
  lowerKind?: AirspaceCriterionFilterPrefs;
  upperKind?: AirspaceCriterionFilterPrefs;
}

function clampAltitudeBand(
  band: AirspaceAltitudeBandFilterPrefs,
  extentMinM: number,
  extentMaxM: number
): AirspaceAltitudeBandFilterPrefs {
  const minM = Math.max(extentMinM, Math.min(band.minM, extentMaxM));
  const maxM = Math.max(extentMinM, Math.min(band.maxM, extentMaxM));
  const lo = Math.min(minM, maxM);
  const hi = Math.max(minM, maxM);
  const active =
    band.active && (lo > extentMinM + 1e-6 || hi < extentMaxM - 1e-6);
  return {
    active,
    minM: active ? lo : extentMinM,
    maxM: active ? hi : extentMaxM
  };
}

export function normalizeAirspaceZoneFilters(
  raw: LegacyAirspaceZoneFiltersPrefs | undefined,
  altitudeExtents?: AirspaceFilterAltitudeExtents | null
): AirspaceZoneFiltersPrefs {
  if (!raw) {
    const base = structuredClone(DEFAULT_AIRSPACE_ZONE_FILTERS);
    if (!altitudeExtents) return base;
    return {
      ...base,
      floorMsl: inactiveBandForExtent(
        altitudeExtents.floorMinM,
        altitudeExtents.floorMaxM
      ),
      ceilingMsl: inactiveBandForExtent(
        altitudeExtents.ceilingMinM,
        altitudeExtents.ceilingMaxM
      )
    };
  }

  const volume =
    raw.volume === 'volumetric' || raw.volume === 'flat' ? raw.volume : 'all';

  const floorDefault = altitudeExtents
    ? inactiveBandForExtent(altitudeExtents.floorMinM, altitudeExtents.floorMaxM)
    : INACTIVE_ALTITUDE_BAND;
  const ceilingDefault = altitudeExtents
    ? inactiveBandForExtent(altitudeExtents.ceilingMinM, altitudeExtents.ceilingMaxM)
    : INACTIVE_ALTITUDE_BAND;

  let floorMsl = normAltitudeBand(raw.floorMsl, floorDefault);
  let ceilingMsl = normAltitudeBand(raw.ceilingMsl, ceilingDefault);

  if (altitudeExtents) {
    floorMsl = clampAltitudeBand(
      floorMsl,
      altitudeExtents.floorMinM,
      altitudeExtents.floorMaxM
    );
    ceilingMsl = clampAltitudeBand(
      ceilingMsl,
      altitudeExtents.ceilingMinM,
      altitudeExtents.ceilingMaxM
    );
  }

  return {
    class: normCriterionFilter(raw.class),
    type: normCriterionFilter(raw.type),
    name: normCriterionFilter(raw.name),
    volume,
    floorMsl,
    ceilingMsl
  };
}

export function inactiveBandForExtent(
  minM: number,
  maxM: number
): AirspaceAltitudeBandFilterPrefs {
  return { active: false, minM, maxM };
}

export function snapAltitudeM(value: number, step = AIRSPACE_ALT_FILTER_STEP_M): number {
  return Math.round(value / step) * step;
}

/** Arrondit et corrige les bornes pour les curseurs. */
export function finalizeAltitudeExtents(
  raw: AirspaceFilterAltitudeExtents
): AirspaceFilterAltitudeExtents {
  const step = AIRSPACE_ALT_FILTER_STEP_M;
  let floorMinM = snapAltitudeM(raw.floorMinM, step);
  let floorMaxM = snapAltitudeM(raw.floorMaxM, step);
  let ceilingMinM = snapAltitudeM(raw.ceilingMinM, step);
  let ceilingMaxM = snapAltitudeM(raw.ceilingMaxM, step);
  if (floorMaxM < floorMinM) floorMaxM = floorMinM;
  if (ceilingMaxM < ceilingMinM) ceilingMaxM = ceilingMinM;
  if (ceilingMinM < floorMinM) ceilingMinM = floorMinM;
  return {
    floorMinM,
    floorMaxM,
    ceilingMinM,
    ceilingMaxM,
    unknownCount: raw.unknownCount
  };
}

/**
 * Plancher / plafond MSL utilisés pour le filtrage (après enrichissement DEM si disponible).
 */
export function featureFloorCeilingMslM(
  props: AirspaceVolumeProperties | PoaffProperties
): { floorM: number | null; ceilingM: number | null } {
  const vol = props as AirspaceVolumeProperties;
  if (
    vol.hasVolume &&
    vol.extrusionBaseM != null &&
    vol.extrusionTopM != null &&
    Number.isFinite(vol.extrusionBaseM) &&
    Number.isFinite(vol.extrusionTopM)
  ) {
    return {
      floorM: Math.min(vol.extrusionBaseM, vol.extrusionTopM),
      ceilingM: Math.max(vol.extrusionBaseM, vol.extrusionTopM)
    };
  }

  const bounds = resolveExtrusionBounds(
    props.lower,
    props.upper,
    props.lowerM,
    props.upperM,
    0
  );
  if (bounds?.hasVolume) {
    return {
      floorM: Math.min(bounds.extrusionBaseM, bounds.extrusionTopM),
      ceilingM: Math.max(bounds.extrusionBaseM, bounds.extrusionTopM)
    };
  }

  const lowerM = props.lowerM;
  const upperM = props.upperM;
  if (
    lowerM != null &&
    upperM != null &&
    Number.isFinite(lowerM) &&
    Number.isFinite(upperM) &&
    upperM > lowerM
  ) {
    return { floorM: lowerM, ceilingM: upperM };
  }

  return { floorM: null, ceilingM: null };
}

function pushSorted(set: Set<string>, value: string | undefined): void {
  const v = (value ?? '').trim();
  if (v) set.add(v);
}

function collectAltitudeExtents(
  collection: FeatureCollection<Geometry, PoaffProperties>
): AirspaceFilterAltitudeExtents | null {
  let floorMinM = Infinity;
  let floorMaxM = -Infinity;
  let ceilingMinM = Infinity;
  let ceilingMaxM = -Infinity;
  let known = 0;
  let unknownCount = 0;

  for (const f of collection.features) {
    const { floorM, ceilingM } = featureFloorCeilingMslM(f.properties ?? {});
    if (floorM == null || ceilingM == null) {
      unknownCount++;
      continue;
    }
    known++;
    floorMinM = Math.min(floorMinM, floorM);
    floorMaxM = Math.max(floorMaxM, floorM);
    ceilingMinM = Math.min(ceilingMinM, ceilingM);
    ceilingMaxM = Math.max(ceilingMaxM, ceilingM);
  }

  if (known === 0) return null;

  return finalizeAltitudeExtents({
    floorMinM,
    floorMaxM,
    ceilingMinM,
    ceilingMaxM,
    unknownCount
  });
}

/** Valeurs distinctes présentes dans la collection (pour l’UI de filtrage). */
export function collectAirspaceFilterOptions(
  collection: FeatureCollection<Geometry, PoaffProperties>
): AirspaceFilterFieldOptions {
  const classes = new Set<string>();
  const types = new Set<string>();

  for (const f of collection.features) {
    const p = f.properties ?? {};
    pushSorted(classes, p.class);
    pushSorted(types, p.type);
  }

  const sort = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
  return {
    class: [...classes].sort(sort),
    type: [...types].sort(sort),
    altitude: collectAltitudeExtents(collection)
  };
}

function altitudeBandMatches(
  valueM: number | null,
  band: AirspaceAltitudeBandFilterPrefs
): boolean {
  if (!band.active) return true;
  if (valueM == null || !Number.isFinite(valueM)) return false;
  return valueM >= band.minM && valueM <= band.maxM;
}

function criterionMatches(
  featureValue: string,
  filter: AirspaceCriterionFilterPrefs,
  matchFn: (featureValue: string, selected: string) => boolean
): boolean {
  if (filter.values.length === 0) return true;
  const hit = filter.values.some(sel => matchFn(featureValue, sel));
  return filter.mode === 'include' ? hit : !hit;
}

function exactMatch(featureValue: string, selected: string): boolean {
  return normText(featureValue) === normText(selected);
}

function substringMatch(featureValue: string, selected: string): boolean {
  const f = featureValue.toLowerCase();
  const s = selected.trim().toLowerCase();
  return s.length > 0 && f.includes(s);
}

export function matchesAirspaceZoneFilters(
  props: AirspaceVolumeProperties | PoaffProperties,
  filters: AirspaceZoneFiltersPrefs
): boolean {
  const hasVolume = (props as AirspaceVolumeProperties).hasVolume === true;
  if (filters.volume === 'volumetric' && !hasVolume) return false;
  if (filters.volume === 'flat' && hasVolume) return false;

  const name = (props.nameV ?? props.id ?? props.GUId ?? '').trim();

  if (
    !criterionMatches(props.class ?? '', filters.class, exactMatch) ||
    !criterionMatches(props.type ?? '', filters.type, exactMatch)
  ) {
    return false;
  }

  const { floorM, ceilingM } = featureFloorCeilingMslM(props);
  if (!altitudeBandMatches(floorM, filters.floorMsl)) return false;
  if (!altitudeBandMatches(ceilingM, filters.ceilingMsl)) return false;

  return criterionMatches(name, filters.name, substringMatch);
}

export function filterAirspaceFeatureCollection<
  P extends PoaffProperties = AirspaceVolumeProperties
>(
  collection: FeatureCollection<Geometry, P>,
  filters: AirspaceZoneFiltersPrefs
): FeatureCollection<Geometry, P> {
  const normalized = normalizeAirspaceZoneFilters(filters);
  const features = collection.features.filter(f =>
    matchesAirspaceZoneFilters(f.properties ?? {}, normalized)
  );
  return { type: 'FeatureCollection', features };
}

export function countActiveAirspaceFilterCriteria(
  filters: AirspaceZoneFiltersPrefs
): number {
  const n = normalizeAirspaceZoneFilters(filters);
  let count = 0;
  if (n.volume !== 'all') count++;
  if (n.class.values.length > 0) count++;
  if (n.type.values.length > 0) count++;
  if (n.name.values.length > 0) count++;
  if (n.floorMsl.active) count++;
  if (n.ceilingMsl.active) count++;
  return count;
}

export function formatAltitudeMslLabel(m: number): string {
  return formatMetersDisplay(m);
}
