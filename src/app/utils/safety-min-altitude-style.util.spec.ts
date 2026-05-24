import { describe, expect, it } from 'vitest';
import type { EnvelopeSample } from '../services/glide-envelope.service';
import {
  buildSafetyMinAltitudeStyledPath,
  buildSafetyMinAltitudeTerrainMarginSections,
  formatSafetyTerrainMarginLabel,
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

  it('formats terrain margin labels', () => {
    expect(formatSafetyTerrainMarginLabel(250)).toBe('+ 250 m');
  });

  it('builds one margin section per red run with max cone gap', () => {
    const sections = buildSafetyMinAltitudeTerrainMarginSections([
      sample({
        distanceKm: 0,
        glideConeM: 1200,
        groundClearanceM: 1100,
        safetyM: 1200
      }),
      sample({
        distanceKm: 1,
        glideConeM: 1000,
        groundClearanceM: 1250,
        safetyM: 1250
      }),
      sample({
        distanceKm: 2,
        glideConeM: 1000,
        groundClearanceM: 1300,
        safetyM: 1300
      }),
      sample({
        distanceKm: 3,
        glideConeM: 1100,
        groundClearanceM: 1050,
        safetyM: 1100
      })
    ]);
    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe('+ 300 m');
    expect(sections[0].maxMarginM).toBe(300);
  });
});
