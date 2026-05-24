import { describe, expect, it } from 'vitest';
import {
  extractFlightLevelFromText,
  FL999_CEILING_M,
  flightLevelToMslM,
  formatAirspaceLimitDisplay,
  formatAirspaceVerticalRange,
  formatChartAltitudeM,
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

  it('formats FL and FT with meter conversion in parentheses', () => {
    expect(formatAirspaceLimitDisplay('FL100')).toMatch(/FL100.*\(.*3[,.]?0?48.*m\)/);
    expect(formatAirspaceLimitDisplay('FL100')).not.toMatch(/m m/);
    expect(formatAirspaceLimitDisplay('2500FT AMSL', 762)).toBe(
      '2500FT AMSL (762 m)'
    );
    expect(formatAirspaceLimitDisplay('2500FT AGL')).toMatch(
      /2500FT AGL.*\(.*762.*m AGL\)/
    );
    expect(formatAirspaceLimitDisplay('2000M')).toMatch(/^2[,.]?000 m$/);
    expect(formatAirspaceVerticalRange('GND', 'FL095')).toMatch(
      /GND.*→.*FL095.*\(/
    );
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

  it('formats chart altitudes without locale thousands separator', () => {
    expect(formatChartAltitudeM(2040)).toBe('2040 m');
    expect(formatChartAltitudeM(981)).toBe('981 m');
  });
});
