import { describe, expect, it } from 'vitest';
import {
  applyAirspaceProfileDisplayLimits,
  maxRelevantTopOnKmInterval,
  relevantTopAtKm,
  safetyMinAtKm
} from './leg-airspace-profile-display.util';
import type { LegAirspaceProfileBandRaw } from './leg-airspace-profile-cross-section.util';

const samples = [
  { distanceKm: 0, safetyM: 500 },
  { distanceKm: 1.4, safetyM: 520 },
  { distanceKm: 2.8, safetyM: 480 }
];

const rawBand = (
  overrides: Partial<LegAirspaceProfileBandRaw> = {}
): LegAirspaceProfileBandRaw => ({
  key: 'z1',
  name: 'Zone test',
  alongStartKm: 0,
  alongEndKm: 2.8,
  floorM: 1000,
  ceilingM: 8000,
  fill: 'rgba(0,0,0,0.2)',
  ...overrides
});

describe('safetyMinAtKm', () => {
  it('interpolates between samples', () => {
    expect(safetyMinAtKm(samples, 1.4)).toBeCloseTo(520, 0);
    expect(safetyMinAtKm(samples, 0.7)).toBeCloseTo(510, 0);
  });
});

describe('relevantTopAtKm', () => {
  it('adds margin above safety mini', () => {
    expect(relevantTopAtKm(samples, 0, 400)).toBe(900);
    expect(relevantTopAtKm(samples, 2.8, 300)).toBe(780);
  });
});

describe('maxRelevantTopOnKmInterval', () => {
  it('uses the highest mini on the interval plus margin', () => {
    expect(maxRelevantTopOnKmInterval(samples, 0, 2.8, 400)).toBe(920);
    expect(maxRelevantTopOnKmInterval(samples, 0, 1.5, 400)).toBe(920);
  });
});

describe('applyAirspaceProfileDisplayLimits', () => {
  it('truncates regulatory ceiling to relevant top', () => {
    const bands = applyAirspaceProfileDisplayLimits(
      [rawBand({ floorM: 200, ceilingM: 8000 })],
      samples,
      400
    );
    expect(bands).toHaveLength(1);
    expect(bands[0].ceilingM).toBe(8000);
    expect(bands[0].displayCeilingM).toBe(920);
    expect(bands[0].ceilingTruncated).toBe(true);
    expect(bands[0].displayFloorM).toBe(200);
  });

  it('omits zones entirely above the flight envelope', () => {
    const bands = applyAirspaceProfileDisplayLimits(
      [rawBand({ floorM: 5000, ceilingM: 9000 })],
      samples,
      400
    );
    expect(bands).toHaveLength(0);
  });

  it('keeps full ceiling when below relevant top', () => {
    const bands = applyAirspaceProfileDisplayLimits(
      [rawBand({ floorM: 200, ceilingM: 800 })],
      samples,
      400
    );
    expect(bands[0].displayCeilingM).toBe(800);
    expect(bands[0].ceilingTruncated).toBe(false);
  });

  it('clips display on a sub-interval with local higher mini', () => {
  const varying = [
    { distanceKm: 0, safetyM: 400 },
    { distanceKm: 5, safetyM: 2000 },
    { distanceKm: 10, safetyM: 450 }
  ];
    const bands = applyAirspaceProfileDisplayLimits(
      [rawBand({ alongStartKm: 4, alongEndKm: 6, floorM: 500, ceilingM: 12000 })],
      varying,
      300
    );
    expect(bands[0].displayCeilingM).toBe(2300);
    expect(bands[0].ceilingTruncated).toBe(true);
  });
});
