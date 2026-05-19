import { describe, it, expect } from 'vitest';
import { buildObsZonePreview } from './obs-zone-preview.util';
import { CircuitLeg } from '../models/circuit.model';
import { Waypoint } from '../models/waypoint.model';

describe('obs-zone-preview.util', () => {
  const wp: Waypoint = {
    id: 't',
    name: 'TP',
    latitude: 45,
    longitude: 6,
    type: 'turnpoint'
  };

  it('builds circle preview for fixed cylinder', () => {
    const leg: CircuitLeg = {
      waypointId: 't',
      role: 'turnpoint',
      obsZone: { cupStyle: 0, r1M: 400, presetId: 'cylinder_fixed' }
    };
    const view = buildObsZonePreview({
      legIndex: 0,
      leg,
      waypoint: wp,
      prev: null,
      next: null,
      departure: null,
      defaultRadiusM: 400
    });
    expect(view?.kind).toBe('circle');
    expect(view?.circleR).toBeGreaterThan(0);
  });

  it('builds line preview for start line', () => {
    const home: Waypoint = {
      id: 'a',
      name: 'AD',
      latitude: 45,
      longitude: 6,
      type: 'airfield'
    };
    const next: Waypoint = {
      id: 't',
      name: 'TP',
      latitude: 45.1,
      longitude: 6.2,
      type: 'turnpoint'
    };
    const leg: CircuitLeg = {
      waypointId: 'a',
      role: 'departure',
      obsZone: { cupStyle: 2, r1M: 500, a1Deg: 180, line: true, presetId: 'start_line' }
    };
    const view = buildObsZonePreview({
      legIndex: 0,
      leg,
      waypoint: home,
      prev: null,
      next,
      departure: home,
      defaultRadiusM: 400
    });
    expect(view?.kind).toBe('line');
    expect(view?.line).toBeDefined();
  });

  it('adds north marker for fixed cylinder', () => {
    const leg: CircuitLeg = {
      waypointId: 't',
      role: 'turnpoint',
      obsZone: { cupStyle: 0, r1M: 400, presetId: 'cylinder_fixed' }
    };
    const view = buildObsZonePreview({
      legIndex: 0,
      leg,
      waypoint: wp,
      prev: null,
      next: null,
      departure: null,
      defaultRadiusM: 400
    });
    expect(view?.markers?.length).toBe(1);
  });

  it('builds sector path for sector zone', () => {
    const leg: CircuitLeg = {
      waypointId: 't',
      role: 'turnpoint',
      obsZone: { cupStyle: 2, r1M: 500, a1Deg: 90, presetId: 'sector_to_next' }
    };
    const next: Waypoint = {
      id: 't2',
      name: 'TP2',
      latitude: 45.2,
      longitude: 6.1,
      type: 'turnpoint'
    };
    const view = buildObsZonePreview({
      legIndex: 0,
      leg,
      waypoint: wp,
      prev: null,
      next,
      departure: null,
      defaultRadiusM: 400
    });
    expect(view?.kind).toBe('sector');
    expect(view?.pathD).toContain('M');
  });

  it('builds ring-sector for FAI sector', () => {
    const leg: CircuitLeg = {
      waypointId: 't',
      role: 'turnpoint',
      obsZone: {
        cupStyle: 0,
        r1M: 30000,
        a1Deg: 45,
        r2M: 12000,
        a2Deg: 12,
        a12Deg: 123.4,
        presetId: 'sector_fai'
      }
    };
    const view = buildObsZonePreview({
      legIndex: 1,
      leg,
      waypoint: wp,
      prev: null,
      next: null,
      departure: null,
      defaultRadiusM: 400
    });
    expect(view?.kind).toBe('ring-sector');
    expect(view?.pathDs?.length).toBe(2);
    expect(view?.pathDs?.[0]).toContain('A');
    expect(view?.pathDs?.[1]).toContain('M');
    // Secteur intérieur : arc à rayon réduit (R2/R1), pas au rayon extérieur.
    expect(view?.pathDs?.[1]).not.toMatch(/A 14 14/);
    expect(view?.pathDs?.[1]).toMatch(/A [\d.]+ [\d.]+/);
  });

  it('returns non-null for every preset type', () => {
    const presets = [
      { cupStyle: 0 as const, r1M: 400 },
      { cupStyle: 1 as const, r1M: 400 },
      { cupStyle: 2 as const, r1M: 400, a1Deg: 180, line: true },
      { cupStyle: 2 as const, r1M: 500, a1Deg: 90 }
    ];
    for (const obsZone of presets) {
      const leg: CircuitLeg = { waypointId: 't', role: 'turnpoint', obsZone };
      const view = buildObsZonePreview({
        legIndex: 0,
        leg,
        waypoint: wp,
        prev: null,
        next: null,
        departure: null,
        defaultRadiusM: 400
      });
      expect(view).not.toBeNull();
    }
  });
});
