import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { Waypoint } from '../../models/waypoint.model';

export interface TaskLegLineInput {
  from: Waypoint;
  to: Waypoint;
  counted: boolean;
  distanceKm: number;
}

export interface TaskLinesGeoJson {
  lines: FeatureCollection<LineString>;
  labels: FeatureCollection<Point>;
}

export function buildTaskLinesGeoJson(legs: TaskLegLineInput[]): TaskLinesGeoJson {
  const lineFeatures: Feature<LineString>[] = [];
  const labelFeatures: Feature<Point>[] = [];

  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const from = leg.from;
    const to = leg.to;
    lineFeatures.push({
      type: 'Feature',
      id: `leg-${i}`,
      geometry: {
        type: 'LineString',
        coordinates: [
          [from.longitude, from.latitude],
          [to.longitude, to.latitude]
        ]
      },
      properties: {
        counted: leg.counted
      }
    });

    const midLng = (from.longitude + to.longitude) / 2;
    const midLat = (from.latitude + to.latitude) / 2;
    labelFeatures.push({
      type: 'Feature',
      id: `leg-label-${i}`,
      geometry: {
        type: 'Point',
        coordinates: [midLng, midLat]
      },
      properties: {
        text: `${leg.distanceKm.toFixed(1)} km`
      }
    });
  }

  return {
    lines: { type: 'FeatureCollection', features: lineFeatures },
    labels: { type: 'FeatureCollection', features: labelFeatures }
  };
}
