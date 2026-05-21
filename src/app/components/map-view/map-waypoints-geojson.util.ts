import type { Feature, FeatureCollection, Point } from 'geojson';
import { Waypoint, WaypointType } from '../../models/waypoint.model';
import { waypointTypeColor } from '../../utils/waypoint-type-display.util';

export interface WaypointMapFeatureProps {
  id: string;
  name: string;
  type: WaypointType;
  color: string;
  suffix: string;
  label: string;
  inCircuit: boolean;
}

export interface BuildWaypointsGeoJsonInput {
  waypoints: Waypoint[];
  getSuffix: (wp: Waypoint) => string | null;
  isInCircuit: (wp: Waypoint) => boolean;
}

/** Rôles aérodrome affichés sur la carte : decollage, atterrissage */
export function formatMapRoleSuffix(labels: string[]): string {
  const parts = labels.map(label =>
    label === 'Décollage' ? 'decollage' : label === 'Atterrissage' ? 'atterrissage' : label.toLowerCase()
  );
  return `(${parts.join(', ')})`;
}

function buildLabel(name: string, suffix: string | null): string {
  return suffix ? `${name} ${suffix}` : name;
}

export function buildWaypointFeature(
  wp: Waypoint,
  suffix: string | null,
  inCircuit: boolean
): Feature<Point, WaypointMapFeatureProps> {
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
      label: buildLabel(wp.name, suffix),
      inCircuit
    }
  };
}

export function buildWaypointsGeoJson(input: BuildWaypointsGeoJsonInput): FeatureCollection<Point> {
  const features = input.waypoints.map(wp =>
    buildWaypointFeature(wp, input.getSuffix(wp), input.isInCircuit(wp))
  );
  return { type: 'FeatureCollection', features };
}

/** Met à jour une collection existante en ne recréant que les features modifiées. */
export function patchWaypointsGeoJson(
  cache: Map<string, Feature<Point, WaypointMapFeatureProps>>,
  input: BuildWaypointsGeoJsonInput
): FeatureCollection<Point> {
  const nextIds = new Set<string>();

  for (const wp of input.waypoints) {
    nextIds.add(wp.id);
    const suffix = input.getSuffix(wp);
    const next = buildWaypointFeature(wp, suffix, input.isInCircuit(wp));
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
    pa.inCircuit !== pb.inCircuit ||
    pa.color !== pb.color
  );
}
