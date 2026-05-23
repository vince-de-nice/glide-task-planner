import { describe, expect, it } from 'vitest';
import type { FeatureCollection, Polygon } from 'geojson';
import type { AirspaceVolumeProperties } from './airspace-volume-enrich.util';
import {
  computeLegAirspaceProfileBands,
  type LegAirspaceProfileLeg
} from './leg-airspace-profile-cross-section.util';

function boxFeature(
  id: string,
  west: number,
  east: number,
  south: number,
  north: number,
  props: Partial<AirspaceVolumeProperties> = {}
): FeatureCollection<Polygon, AirspaceVolumeProperties> {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id,
        properties: {
          nameV: `Zone ${id}`,
          GUId: id,
          lowerM: 1000,
          upperM: 3000,
          hasVolume: true,
          extrusionBaseM: 1000,
          extrusionTopM: 3000,
          ...props
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south]
            ]
          ]
        }
      }
    ]
  };
}

const legAlongLat: LegAirspaceProfileLeg = {
  fromLng: 5.0,
  fromLat: 45.0,
  toLng: 5.1,
  toLat: 45.0,
  legLengthKm: 7.8,
  profileStartKm: 0,
  profileEndKm: 12
};

describe('computeLegAirspaceProfileBands', () => {
  it('returns empty when no zones enabled', () => {
    const fc = boxFeature('z1', 5.04, 5.06, 44.96, 45.04);
    expect(
      computeLegAirspaceProfileBands(legAlongLat, fc, new Set())
    ).toEqual([]);
  });

  it('returns along-range where leg crosses polygon', () => {
    const fc = boxFeature('z1', 5.04, 5.06, 44.96, 45.04);
    const bands = computeLegAirspaceProfileBands(
      legAlongLat,
      fc,
      new Set(['z1'])
    );
    expect(bands).toHaveLength(1);
    expect(bands[0].key).toBe('z1');
    expect(bands[0].floorM).toBe(1000);
    expect(bands[0].ceilingM).toBe(3000);
    expect(bands[0].alongStartKm).toBeGreaterThan(0);
    expect(bands[0].alongEndKm).toBeLessThan(legAlongLat.legLengthKm);
    expect(bands[0].alongEndKm).toBeGreaterThan(bands[0].alongStartKm);
  });

  it('covers full leg when endpoints are inside', () => {
    const fc = boxFeature('wide', 4.9, 5.2, 44.9, 45.1);
    const bands = computeLegAirspaceProfileBands(
      legAlongLat,
      fc,
      new Set(['wide'])
    );
    expect(bands).toHaveLength(1);
    expect(bands[0].alongStartKm).toBeCloseTo(0, 1);
    expect(bands[0].alongEndKm).toBeCloseTo(legAlongLat.legLengthKm, 1);
  });

  it('clips to profile extent', () => {
    const fc = boxFeature('wide', 4.9, 5.2, 44.9, 45.1);
    const bands = computeLegAirspaceProfileBands(
      {
        ...legAlongLat,
        profileStartKm: 2,
        profileEndKm: 5
      },
      fc,
      new Set(['wide'])
    );
    expect(bands[0].alongStartKm).toBeGreaterThanOrEqual(2);
    expect(bands[0].alongEndKm).toBeLessThanOrEqual(5);
  });

  it('skips zones without vertical bounds', () => {
    const fc = boxFeature('z1', 5.04, 5.06, 44.96, 45.04, {
      hasVolume: false,
      extrusionBaseM: undefined,
      extrusionTopM: undefined,
      lowerM: undefined,
      upperM: undefined
    });
    expect(
      computeLegAirspaceProfileBands(legAlongLat, fc, new Set(['z1']))
    ).toEqual([]);
  });
});
