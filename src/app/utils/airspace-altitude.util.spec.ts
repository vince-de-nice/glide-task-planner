import { describe, expect, it } from 'vitest';
import {
  extractFlightLevelFromText,
  FL999_CEILING_M,
  flightLevelToMslM,
  parseAirspaceLimit,
  resolveCeilingMslM,
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

  it('parses FL999 in composite labels and ignores bogus upperM', () => {
    expect(extractFlightLevelFromText('SFC → FL999')).toBe(999);
    expect(parseAirspaceLimit('FL999')?.valueM).toBeCloseTo(FL999_CEILING_M, 0);
    expect(resolveCeilingMslM('FL999', 999)).toBeCloseTo(FL999_CEILING_M, 0);
    expect(resolveCeilingMslM('FL999', 30449)).toBeCloseTo(30449, 0);
  });

  it('builds extrusion bounds for SFC → FL999 with DEM floor', () => {
    const bounds = resolveExtrusionBounds('SFC', 'FL999', 0, 30449, 2761);
    expect(bounds?.extrusionTopM).toBe(30449);
    expect(bounds?.extrusionBaseM).toBeCloseTo(2761, 0);
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
