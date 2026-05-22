import { describe, expect, it } from 'vitest';
import {
  flightLevelToMslM,
  parseAirspaceLimit,
  resolveExtrusionBounds
} from './airspace-altitude.util';

describe('airspace-altitude.util', () => {
  it('converts flight levels with standard pressure', () => {
    expect(flightLevelToMslM(115)).toBeCloseTo(3505.2, 0);
  });

  it('parses FT AMSL and AGL without converting AMSL feet to FL', () => {
    const amsl = parseAirspaceLimit('2500FT AMSL');
    expect(amsl?.kind).toBe('msl');
    expect(amsl?.valueM).toBeCloseTo(762, 0);

    const agl = parseAirspaceLimit('2000FT AGL');
    expect(agl?.kind).toBe('agl');
    expect(agl?.valueM).toBeCloseTo(609.6, 0);
  });

  it('builds extrusion bounds with DEM for AGL floor', () => {
    const bounds = resolveExtrusionBounds(
      '2000FT AGL',
      'FL115',
      861,
      3505,
      400
    );
    expect(bounds?.hasVolume).toBe(true);
    expect(bounds?.extrusionBaseM).toBeCloseTo(400 + 609.6, 0);
    expect(bounds?.extrusionTopM).toBeCloseTo(flightLevelToMslM(115), 0);
  });
});
