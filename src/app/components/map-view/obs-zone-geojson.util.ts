import type { Feature, FeatureCollection, LineString, Polygon } from 'geojson';
import {
  buildCircuitObsZoneShapes,
  faiKeyholePolygonLatLngs,
  ObsZoneMapShape,
  obsZoneMapColors,
  ringSectorPolygonLatLngs,
  sectorPolygonLatLngs,
  LatLngTuple
} from '../../utils/obs-zone-map.util';
import { CircuitLeg } from '../../models/circuit.model';
import { Waypoint } from '../../models/waypoint.model';

export interface ObsZoneFeatureProps {
  legIndex: number;
  label: string;
  stroke: string;
  fill: string;
}

function latLngRing(ring: LatLngTuple[]): number[][] {
  const coords = ring.map(([lat, lon]) => [lon, lat]);
  if (coords.length > 0) {
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coords.push([...first]);
    }
  }
  return coords;
}

function circleRing(center: LatLngTuple, radiusM: number, steps = 64): number[][] {
  return latLngRing(sectorPolygonLatLngs(center, radiusM, 0, 360, steps));
}

export function obsZoneShapeToFeature(shape: ObsZoneMapShape): Feature<Polygon | LineString> | null {
  const colors = obsZoneMapColors(shape.role);
  const props: ObsZoneFeatureProps = {
    legIndex: shape.legIndex,
    label: `Pt ${shape.legIndex + 1} · ${shape.label}`,
    stroke: colors.stroke,
    fill: colors.fill
  };

  if (shape.kind === 'line' && shape.linePoints?.length === 2) {
    return {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: shape.linePoints.map(([lat, lon]) => [lon, lat])
      },
      properties: { ...props, isLine: true as const }
    };
  }

  let ring: number[][] | null = null;

  if (
    shape.kind === 'fai-keyhole' &&
    shape.radiusM != null &&
    shape.innerRadiusM != null &&
    shape.startBearingDeg != null &&
    shape.endBearingDeg != null &&
    shape.innerStartBearingDeg != null &&
    shape.innerEndBearingDeg != null
  ) {
    ring = latLngRing(
      faiKeyholePolygonLatLngs(
        shape.center,
        shape.radiusM,
        shape.innerRadiusM,
        shape.innerStartBearingDeg,
        shape.innerEndBearingDeg,
        shape.startBearingDeg,
        shape.endBearingDeg
      )
    );
  } else if (
    (shape.kind === 'sector' || shape.kind === 'ring-sector') &&
    shape.radiusM != null &&
    shape.startBearingDeg != null &&
    shape.endBearingDeg != null
  ) {
    const pts =
      shape.kind === 'ring-sector' && shape.innerRadiusM
        ? ringSectorPolygonLatLngs(
            shape.center,
            shape.radiusM,
            shape.innerRadiusM,
            shape.startBearingDeg,
            shape.endBearingDeg
          )
        : sectorPolygonLatLngs(
            shape.center,
            shape.radiusM,
            shape.startBearingDeg,
            shape.endBearingDeg
          );
    ring = latLngRing(pts);
  } else if (shape.kind === 'circle' && shape.radiusM != null) {
    ring = circleRing(shape.center, shape.radiusM);
  }

  if (!ring || ring.length < 4) {
    return null;
  }

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [ring]
    },
    properties: props
  };
}

export function buildObsZonesGeoJson(shapes: ObsZoneMapShape[]): FeatureCollection {
  const features: Feature<Polygon | LineString>[] = [];
  for (const shape of shapes) {
    const f = obsZoneShapeToFeature(shape);
    if (f) {
      features.push(f);
    }
  }
  return { type: 'FeatureCollection', features };
}

export function buildObsZoneShapesForCircuit(
  legs: CircuitLeg[],
  waypointById: Map<string, Waypoint>,
  defaultRadiusM: number
): ObsZoneMapShape[] {
  return buildCircuitObsZoneShapes(legs, waypointById, defaultRadiusM);
}
