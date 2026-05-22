import { describe, expect, it } from 'vitest';
import {
  coneSafetyAltitudeAtRingDiameterM,
  formatConeRingAltitudeLabel,
  roundAltitudeToUpper50M
} from './safety-cone-ring-labels.util';

describe('safety-cone-ring-labels', () => {
  it('roundAltitudeToUpper50M rounds up to next 50 m', () => {
    expect(roundAltitudeToUpper50M(2400)).toBe(2400);
    expect(roundAltitudeToUpper50M(2401)).toBe(2450);
    expect(roundAltitudeToUpper50M(2450)).toBe(2450);
  });

  it('formatConeRingAltitudeLabel includes unit', () => {
    expect(formatConeRingAltitudeLabel(2430)).toBe('2450 m');
  });

  it('coneSafetyAltitudeAtRingDiameterM follows glide slope', () => {
    const tip = 1000;
    const halfRatio = 20;
    const diameterKm = 10;
    const alt = coneSafetyAltitudeAtRingDiameterM(
      tip,
      tip + 2000,
      diameterKm,
      halfRatio
    );
    expect(alt).toBe(1000 + (5 * 1000) / 20);
  });
});
