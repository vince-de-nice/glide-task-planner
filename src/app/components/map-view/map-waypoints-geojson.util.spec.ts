import { describe, it, expect } from 'vitest';
import {
  buildWaypointFeature,
  buildWaypointsGeoJson,
  formatMapRoleSuffix,
  patchWaypointsGeoJson
} from './map-waypoints-geojson.util';
import type { WaypointMapFeatureProps } from './map-waypoints-geojson.util';
import type { Feature, Point } from 'geojson';

describe('map-waypoints-geojson.util', () => {
  it('formats role suffix in lowercase', () => {
    expect(formatMapRoleSuffix(['Décollage', 'Atterrissage'])).toBe('(decollage, atterrissage)');
  });

  it('builds label with suffix', () => {
    const f = buildWaypointFeature(
      {
        id: 'a',
        name: 'Vinon',
        latitude: 43.5,
        longitude: 5.7,
        type: 'airfield'
      },
      '(1,5)',
      true
    );
    expect(f.properties?.label).toBe('Vinon (1,5)');
    expect(f.geometry.coordinates).toEqual([5.7, 43.5]);
  });

  it('does not duplicate feature ids in collection', () => {
    const wp = {
      id: 'x',
      name: 'A',
      latitude: 1,
      longitude: 2,
      type: 'turnpoint' as const
    };
    const fc = buildWaypointsGeoJson({
      waypoints: [wp, wp],
      getSuffix: () => null,
      isInCircuit: () => false
    });
    expect(fc.features).toHaveLength(2);
  });

  it('patch keeps cache size in sync', () => {
    const cache = new Map<string, Feature<Point, WaypointMapFeatureProps>>();
    const wp = {
      id: '1',
      name: 'B',
      latitude: 10,
      longitude: 20,
      type: 'custom' as const
    };
    patchWaypointsGeoJson(cache, {
      waypoints: [wp],
      getSuffix: () => null,
      isInCircuit: () => false
    });
    expect(cache.size).toBe(1);
    patchWaypointsGeoJson(cache, {
      waypoints: [],
      getSuffix: () => null,
      isInCircuit: () => false
    });
    expect(cache.size).toBe(0);
  });
});
