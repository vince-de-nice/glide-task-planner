import { describe, it, expect } from 'vitest';
import {
  cupZoneParamVisibility,
  formatCupObsZoneLine,
  observationZoneFromPreset,
  defaultObservationZoneForRole
} from './observation-zone.model';

describe('observation-zone.model', () => {
  it('formats start line ObsZone per Naviter CUP', () => {
    const z = observationZoneFromPreset('start_line', 400);
    expect(formatCupObsZoneLine(0, z)).toBe('ObsZone=0,Style=2,R1=400m,A1=180,Line=1');
  });

  it('defaults departure to start line', () => {
    const z = defaultObservationZoneForRole('departure', 300);
    expect(z.line).toBe(true);
    expect(z.cupStyle).toBe(2);
  });

  it('cupZoneParamVisibility hides sector params for plain cylinder', () => {
    const z = observationZoneFromPreset('cylinder_fixed', 400);
    const vis = cupZoneParamVisibility(z, { legRole: 'turnpoint' });
    expect(vis).toEqual({
      style: true,
      r1: true,
      a1: false,
      r2: false,
      a2: false,
      a12: false,
      line: false
    });
  });

  it('cupZoneParamVisibility shows line fields for departure start line', () => {
    const z = observationZoneFromPreset('start_line', 400);
    const vis = cupZoneParamVisibility(z, { legRole: 'departure' });
    expect(vis.a1).toBe(true);
    expect(vis.line).toBe(true);
    expect(vis.a12).toBe(false);
  });

  it('cupZoneParamVisibility shows A12 only for fixed sector', () => {
    const z = observationZoneFromPreset('sector_fai', 400);
    const vis = cupZoneParamVisibility(z, { legRole: 'turnpoint' });
    expect(vis.a12).toBe(true);
    expect(vis.a2).toBe(true);
    expect(vis.r2).toBe(true);
  });
});
