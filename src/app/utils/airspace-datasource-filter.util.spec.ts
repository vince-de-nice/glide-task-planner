import { describe, expect, it } from 'vitest';
import type { FeatureCollection, Polygon } from 'geojson';
import type { AirspaceZoneClassTypeProps } from './airspace-datasource-filter.util';
import {
  filterAreaGeoFromAirspaceCollection,
  isAreaOrGeoAirspaceZone
} from './airspace-datasource-filter.util';

function fc(
  ...features: Array<{ type?: string; class?: string; id: string }>
): FeatureCollection<Polygon, AirspaceZoneClassTypeProps & { id: string }> {
  return {
    type: 'FeatureCollection',
    features: features.map(f => ({
      type: 'Feature',
      id: f.id,
      properties: { id: f.id, type: f.type, class: f.class },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0]
          ]
        ]
      }
    }))
  };
}

describe('isAreaOrGeoAirspaceZone', () => {
  it('detects type GEO', () => {
    expect(isAreaOrGeoAirspaceZone({ type: 'GEO', class: 'AREA' })).toBe(true);
    expect(isAreaOrGeoAirspaceZone({ type: 'geo' })).toBe(true);
  });

  it('detects class AREA', () => {
    expect(isAreaOrGeoAirspaceZone({ class: 'AREA', type: 'RESTRICTED' })).toBe(
      true
    );
  });

  it('keeps operational zones', () => {
    expect(isAreaOrGeoAirspaceZone({ class: 'D', type: 'CTR' })).toBe(false);
  });
});

describe('filterAreaGeoFromAirspaceCollection', () => {
  it('removes AREA and GEO features', () => {
    const input = fc(
      { id: 'geo', type: 'GEO', class: 'AREA' },
      { id: 'area', class: 'AREA', type: 'RESTRICTED' },
      { id: 'ctr', class: 'D', type: 'CTR' }
    );
    const out = filterAreaGeoFromAirspaceCollection(input);
    expect(out.features.map(f => f.id)).toEqual(['ctr']);
  });
});
