import { describe, expect, it } from 'vitest';
import {
  ceilTo500M,
  computeProfileYMinM,
  defaultLegYMaxM,
  maxSafetyMinAltitudeM
} from './safety-profile-chart.util';

describe('maxSafetyMinAltitudeM', () => {
  it('returns the highest finite safetyM', () => {
    expect(
      maxSafetyMinAltitudeM([
        { safetyM: 1200 },
        { safetyM: 2140 },
        { safetyM: 1800 }
      ])
    ).toBe(2140);
  });

  it('ignores null and non-finite values', () => {
    expect(
      maxSafetyMinAltitudeM([
        { safetyM: null },
        { safetyM: Number.NaN },
        { safetyM: 900 }
      ])
    ).toBe(900);
  });
});

describe('ceilTo500M', () => {
  it('rounds up to the next multiple of 500', () => {
    expect(ceilTo500M(2500)).toBe(2500);
    expect(ceilTo500M(2600)).toBe(3000);
    expect(ceilTo500M(2601)).toBe(3000);
    expect(ceilTo500M(1)).toBe(500);
  });
});

describe('defaultLegYMaxM', () => {
  it('uses highest safety min + 500 m rounded up to 500 m', () => {
    expect(
      defaultLegYMaxM([
        { safetyM: 1200 },
        { safetyM: 2140 },
        { safetyM: 1800 }
      ])
    ).toBe(3000);
  });

  it('aligns yMax when mini + margin lands on a 500 m step', () => {
    expect(defaultLegYMaxM([{ safetyM: 2000 }])).toBe(2500);
  });

  it('returns 1000 m when no safety min altitude is available', () => {
    expect(defaultLegYMaxM([{ safetyM: null }])).toBe(1000);
    expect(defaultLegYMaxM([])).toBe(1000);
  });
});

describe('computeProfileYMinM', () => {
  it('stays below yMax with padding around content', () => {
    expect(computeProfileYMinM(280, 1400)).toBe(100);
    expect(computeProfileYMinM(280, 1400)).toBeLessThan(1400);
  });

  it('does not force zero when content is well above sea level', () => {
    expect(computeProfileYMinM(1800, 3500)).toBeGreaterThan(0);
  });
});
