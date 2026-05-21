import { describe, it, expect } from 'vitest';
import {
  buildWaypointFeature,
  buildWaypointsGeoJson,
  defaultTaskBadge,
  formatMapRoleSuffix,
  patchWaypointsGeoJson,
  type BuildWaypointsGeoJsonInput,
  type WaypointMapFeatureProps
} from './map-waypoints-geojson.util';
import type { Feature, Point } from 'geojson';

const baseInput = (overrides: Partial<BuildWaypointsGeoJsonInput> = {}): BuildWaypointsGeoJsonInput => ({
  waypoints: [],
  getSuffix: () => null,
  getBadge: wp => defaultTaskBadge(wp, []),
  isInCircuit: () => false,
  isInTask: () => false,
  isCatalogOnly: () => false,
  isFocused: () => false,
  ...overrides
});

describe('map-waypoints-geojson.util', () => {
  it('formats role suffix in lowercase', () => {
    expect(formatMapRoleSuffix(['Décollage', 'Atterrissage'])).toBe('(decollage, atterrissage)');
  });

  it('builds label with suffix and task flags', () => {
    const wp = {
      id: 'a',
      name: 'Vinon',
      latitude: 43.5,
      longitude: 5.7,
      type: 'airfield' as const
    };
    const f = buildWaypointFeature(
      wp,
      baseInput({
        getSuffix: () => '(1,5)',
        isInTask: () => true,
        isFocused: () => true
      })
    );
    expect(f.properties?.label).toBe('Vinon (1,5)');
    expect(f.properties?.inTask).toBe(1);
    expect(f.properties?.focused).toBe(1);
    expect(f.geometry.coordinates).toEqual([5.7, 43.5]);
  });

  it('marks catalog-only when not in task', () => {
    const wp = {
      id: 'c',
      name: 'X',
      latitude: 1,
      longitude: 2,
      type: 'turnpoint' as const
    };
    const f = buildWaypointFeature(
      wp,
      baseInput({
        isCatalogOnly: () => true
      })
    );
    expect(f.properties?.inCatalogOnly).toBe(1);
    expect(f.properties?.inTask).toBe(0);
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
    patchWaypointsGeoJson(cache, baseInput({ waypoints: [wp] }));
    expect(cache.size).toBe(1);
    patchWaypointsGeoJson(cache, baseInput({ waypoints: [] }));
    expect(cache.size).toBe(0);
  });

  it('defaultTaskBadge uses leg index or type short label', () => {
    const wp = {
      id: 'w',
      name: 'P',
      latitude: 0,
      longitude: 0,
      type: 'turnpoint' as const
    };
    expect(defaultTaskBadge(wp, [0, 2])).toBe('1+');
    expect(defaultTaskBadge(wp, [3])).toBe('4');
    expect(defaultTaskBadge(wp, [])).toBe('TP');
  });

  it('builds one feature per waypoint in collection', () => {
    const wp = {
      id: 'x',
      name: 'A',
      latitude: 1,
      longitude: 2,
      type: 'turnpoint' as const
    };
    const fc = buildWaypointsGeoJson(baseInput({ waypoints: [wp, { ...wp, name: 'B' }] }));
    expect(fc.features).toHaveLength(2);
  });
});
