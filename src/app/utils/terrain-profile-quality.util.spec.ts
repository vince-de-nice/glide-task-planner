import { describe, expect, it } from 'vitest';
import { isFullyDemProfile } from './terrain-profile-quality.util';
import type { LegProfile } from '../models/terrain-profile.types';

describe('isFullyDemProfile', () => {
  const base: LegProfile = {
    fromLngLat: [0, 0],
    toLngLat: [1, 1],
    totalDistanceKm: 10,
    sampleCount: 2,
    hasGaps: false,
    samples: [
      { distanceKm: 0, longitude: 0, latitude: 0, elevationM: 100, elevationQuality: 'dem' },
      { distanceKm: 10, longitude: 1, latitude: 1, elevationM: 200, elevationQuality: 'dem' }
    ]
  };

  it('returns true for pure dem', () => {
    expect(isFullyDemProfile(base)).toBe(true);
  });

  it('returns false for dem-low', () => {
    expect(
      isFullyDemProfile({
        ...base,
        samples: [{ ...base.samples[0], elevationQuality: 'dem-low' }, base.samples[1]]
      })
    ).toBe(false);
  });
});
