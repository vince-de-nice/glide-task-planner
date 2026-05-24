import { describe, expect, it } from 'vitest';
import type { EnvelopeSample } from '../services/glide-envelope.service';
import {
  buildSafetyMinAltitudeStyledPath,
  isSafetyMinAltitudeTerrainConstrained
} from './safety-min-altitude-style.util';

function sample(
  partial: Partial<EnvelopeSample> & Pick<EnvelopeSample, 'distanceKm'>
): EnvelopeSample {
  return {
    longitude: 5,
    latitude: 44,
    terrainM: 500,
    terrainQuality: 'dem',
    groundClearanceM: null,
    glideConeM: null,
    safetyM: null,
    closestLandableId: null,
    closestLandableDistanceKm: null,
    ...partial
  };
}

describe('safety-min-altitude-style', () => {
  it('classifies cone-driven vs terrain-constrained samples', () => {
    expect(
      isSafetyMinAltitudeTerrainConstrained(
        sample({ distanceKm: 0, glideConeM: 1200, groundClearanceM: 1100, safetyM: 1200 })
      )
    ).toBe(false);
    expect(
      isSafetyMinAltitudeTerrainConstrained(
        sample({ distanceKm: 1, glideConeM: 1200, groundClearanceM: 1300, safetyM: 1300 })
      )
    ).toBe(true);
    expect(
      isSafetyMinAltitudeTerrainConstrained(
        sample({ distanceKm: 2, glideConeM: null, groundClearanceM: 900, safetyM: 900 })
      )
    ).toBe(true);
  });

  it('inserts a crossing point when style changes along the leg', () => {
    const path = buildSafetyMinAltitudeStyledPath([
      sample({
        distanceKm: 0,
        glideConeM: 1200,
        groundClearanceM: 1100,
        safetyM: 1200
      }),
      sample({
        distanceKm: 2,
        glideConeM: 1000,
        groundClearanceM: 1150,
        safetyM: 1150
      })
    ]);
    expect(path.length).toBeGreaterThanOrEqual(3);
    expect(path.some(p => !p.terrainConstrained)).toBe(true);
    expect(path.some(p => p.terrainConstrained)).toBe(true);
  });

});
