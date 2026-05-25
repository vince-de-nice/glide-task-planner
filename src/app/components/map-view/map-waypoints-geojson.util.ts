import type { Feature, FeatureCollection, Point } from 'geojson';
import { Waypoint, WaypointType } from '../../models/waypoint.model';
import {
  waypointTypeColor,
  waypointTypeShortLabel
} from '../../utils/waypoint-type-display.util';

export interface WaypointMapFeatureProps {
  id: string;
  name: string;
  type: WaypointType;
  color: string;
  suffix: string;
  label: string;
  /** Abréviation type (TP, AD…) ou numéro de leg pour badge tâche */
  badge: string;
  inCircuit: boolean;
  inTask: number;
  inCatalogOnly: number;
  focused: number;
}

export interface BuildWaypointsGeoJsonInput {
  waypoints: Waypoint[];
  getSuffix: (wp: Waypoint) => string | null;
  getBadge: (wp: Waypoint) => string;
  isInCircuit: (wp: Waypoint) => boolean;
  isInTask: (wp: Waypoint) => boolean;
  isCatalogOnly: (wp: Waypoint) => boolean;
  isFocused: (wp: Waypoint) => boolean;
}

/** Rôles aérodrome affichés sur la carte : decollage, atterrissage */
export function formatMapRoleSuffix(labels: string[]): string {
  const parts = labels.map(label =>
    label === 'Décollage' ? 'decollage' : label === 'Atterrissage' ? 'atterrissage' : label.toLowerCase()
  );
  return `(${parts.join(', ')})`;
}

function buildLabel(
  name: string,
  suffix: string | null,
  elevationM?: number
): string {
  const parts = [name];
  if (suffix) parts.push(suffix);
  if (elevationM != null && Number.isFinite(elevationM)) {
    parts.push(`${Math.round(elevationM)} m`);
  }
  return parts.join(' ');
}

export function buildWaypointFeature(
  wp: Waypoint,
  input: BuildWaypointsGeoJsonInput
): Feature<Point, WaypointMapFeatureProps> {
  const suffix = input.getSuffix(wp);
  const suffixStr = suffix ?? '';
  return {
    type: 'Feature',
    id: wp.id,
    geometry: {
      type: 'Point',
      coordinates: [wp.longitude, wp.latitude]
    },
    properties: {
      id: wp.id,
      name: wp.name,
      type: wp.type,
      color: waypointTypeColor(wp.type),
      suffix: suffixStr,
      label: buildLabel(
        wp.name,
        suffix,
        wp.type === 'custom' ? wp.elevation : undefined
      ),
      badge: input.getBadge(wp),
      inCircuit: input.isInCircuit(wp),
      inTask: input.isInTask(wp) ? 1 : 0,
      inCatalogOnly: input.isCatalogOnly(wp) ? 1 : 0,
      focused: input.isFocused(wp) ? 1 : 0
    }
  };
}

export function buildWaypointsGeoJson(input: BuildWaypointsGeoJsonInput): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: input.waypoints.map(wp => buildWaypointFeature(wp, input))
  };
}

/** Met à jour une collection existante en ne recréant que les features modifiées. */
export function patchWaypointsGeoJson(
  cache: Map<string, Feature<Point, WaypointMapFeatureProps>>,
  input: BuildWaypointsGeoJsonInput
): FeatureCollection<Point> {
  const nextIds = new Set<string>();

  for (const wp of input.waypoints) {
    nextIds.add(wp.id);
    const next = buildWaypointFeature(wp, input);
    const prev = cache.get(wp.id);
    if (!prev || waypointFeatureChanged(prev, next)) {
      cache.set(wp.id, next);
    }
  }

  for (const id of cache.keys()) {
    if (!nextIds.has(id)) {
      cache.delete(id);
    }
  }

  return { type: 'FeatureCollection', features: [...cache.values()] };
}

function waypointFeatureChanged(
  a: Feature<Point, WaypointMapFeatureProps>,
  b: Feature<Point, WaypointMapFeatureProps>
): boolean {
  if (a.geometry.coordinates[0] !== b.geometry.coordinates[0]) return true;
  if (a.geometry.coordinates[1] !== b.geometry.coordinates[1]) return true;
  const pa = a.properties;
  const pb = b.properties;
  return (
    pa.name !== pb.name ||
    pa.type !== pb.type ||
    pa.suffix !== pb.suffix ||
    pa.label !== pb.label ||
    pa.badge !== pb.badge ||
    pa.inCircuit !== pb.inCircuit ||
    pa.inTask !== pb.inTask ||
    pa.inCatalogOnly !== pb.inCatalogOnly ||
    pa.focused !== pb.focused ||
    pa.color !== pb.color
  );
}

/** Badge tâche : numéro de leg ou abréviation type. */
export function defaultTaskBadge(
  wp: Waypoint,
  legIndices: number[]
): string {
  if (legIndices.length === 1) {
    return String(legIndices[0] + 1);
  }
  if (legIndices.length > 1) {
    return `${legIndices[0] + 1}+`;
  }
  return waypointTypeShortLabel(wp.type);
}
