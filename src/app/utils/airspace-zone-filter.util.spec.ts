import { describe, expect, it } from 'vitest';
import {
  collectAirspaceFilterOptions,
  DEFAULT_AIRSPACE_ZONE_FILTERS,
  featureFloorCeilingMslM,
  filterAirspaceFeatureCollection,
  matchesAirspaceZoneFilters,
  normalizeAirspaceZoneFilters
} from './airspace-zone-filter.util';

const baseFeature = {
  type: 'Feature' as const,
  properties: {
    class: 'RMZ',
    type: 'Restricted',
    lower: 'GND',
    upper: '4500FT AMSL',
    nameV: 'Zone Test Alpha',
    hasVolume: true,
    extrusionBaseM: 500,
    extrusionTopM: 2000
  },
  geometry: {
    type: 'Polygon' as const,
    coordinates: [
      [
        [1, 2],
        [2, 2],
        [2, 3],
        [1, 2]
      ]
    ]
  }
};

describe('airspace-zone-filter.util', () => {
  it('lit plancher et plafond depuis les propriétés 3D', () => {
    expect(featureFloorCeilingMslM(baseFeature.properties)).toEqual({
      floorM: 500,
      ceilingM: 2000
    });
  });

  it('filtre par intervalle de plancher MSL', () => {
    expect(
      matchesAirspaceZoneFilters(baseFeature.properties, {
        ...DEFAULT_AIRSPACE_ZONE_FILTERS,
        floorMsl: { active: true, minM: 600, maxM: 3000 }
      })
    ).toBe(false);

    expect(
      matchesAirspaceZoneFilters(baseFeature.properties, {
        ...DEFAULT_AIRSPACE_ZONE_FILTERS,
        floorMsl: { active: true, minM: 400, maxM: 600 }
      })
    ).toBe(true);
  });

  it('filtre par intervalle de plafond MSL', () => {
    expect(
      matchesAirspaceZoneFilters(baseFeature.properties, {
        ...DEFAULT_AIRSPACE_ZONE_FILTERS,
        ceilingMsl: { active: true, minM: 1000, maxM: 1500 }
      })
    ).toBe(false);

    expect(
      matchesAirspaceZoneFilters(baseFeature.properties, {
        ...DEFAULT_AIRSPACE_ZONE_FILTERS,
        ceilingMsl: { active: true, minM: 1500, maxM: 2500 }
      })
    ).toBe(true);
  });

  it('collecte les extrema d’altitude', () => {
    const opts = collectAirspaceFilterOptions({
      type: 'FeatureCollection',
      features: [baseFeature]
    });
    expect(opts.class).toContain('RMZ');
    expect(opts.altitude).toEqual({
      floorMinM: 500,
      floorMaxM: 500,
      ceilingMinM: 2000,
      ceilingMaxM: 2000,
      unknownCount: 0
    });
  });

  it('normalise les curseurs sur les extrema de la région', () => {
    const ext = {
      floorMinM: 100,
      floorMaxM: 5000,
      ceilingMinM: 500,
      ceilingMaxM: 8000,
      unknownCount: 0
    };
    const n = normalizeAirspaceZoneFilters(
      {
        floorMsl: { active: false, minM: 0, maxM: 99_999 }
      },
      ext
    );
    expect(n.floorMsl).toEqual({ active: false, minM: 100, maxM: 5000 });
  });

  it('filtre par classe en mode inclusion', () => {
    const fc = {
      type: 'FeatureCollection' as const,
      features: [
        baseFeature,
        {
          ...baseFeature,
          properties: { ...baseFeature.properties, class: 'CTR' }
        }
      ]
    };
    const filtered = filterAirspaceFeatureCollection(fc, {
      ...DEFAULT_AIRSPACE_ZONE_FILTERS,
      class: { mode: 'include', values: ['RMZ'] }
    });
    expect(filtered.features).toHaveLength(1);
  });
});
