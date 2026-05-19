import { describe, it, expect } from 'vitest';
import {
  bearingDegrees,
  cupFixedAxisBearingDeg,
  cupZoneReferenceBearingDeg,
  destinationPoint,
  buildObsZoneMapShapes
} from './obs-zone-map.util';
import { CircuitLeg } from '../models/circuit.model';
import { Waypoint } from '../models/waypoint.model';

describe('obs-zone-map.util', () => {
  it('computes destination ~1km north', () => {
    const [lat, lon] = destinationPoint(45, 6, 0, 1000);
    expect(lat).toBeGreaterThan(45);
    expect(Math.abs(lon - 6)).toBeLessThan(0.05);
  });

  it('builds line shape for start line zone', () => {
    const home: Waypoint = {
      id: 'a',
      name: 'AD',
      latitude: 45,
      longitude: 6,
      type: 'airfield'
    };
    const tp: Waypoint = {
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
    const shapes = buildObsZoneMapShapes({
      legIndex: 0,
      leg,
      waypoint: home,
      prev: null,
      next: tp,
      departure: home,
      defaultRadiusM: 400
    });
    expect(shapes[0].kind).toBe('line');
    expect(shapes[0].linePoints?.length).toBe(2);
  });

  it('builds circle for fixed cylinder', () => {
    const wp: Waypoint = {
      id: 't',
      name: 'TP',
      latitude: 45,
      longitude: 6,
      type: 'turnpoint'
    };
    const leg: CircuitLeg = {
      waypointId: 't',
      role: 'turnpoint',
      obsZone: { cupStyle: 0, r1M: 400, presetId: 'cylinder_fixed' }
    };
    const shapes = buildObsZoneMapShapes({
      legIndex: 0,
      leg,
      waypoint: wp,
      prev: null,
      next: null,
      departure: null,
      defaultRadiusM: 400
    });
    expect(shapes[0].kind).toBe('circle');
    expect(shapes[0].radiusM).toBe(400);
  });

  it('cupFixedAxisBearingDeg applies XCSoar reciprocal (A12 + 180°)', () => {
    expect(cupFixedAxisBearingDeg(90)).toBe(270);
    expect(cupFixedAxisBearingDeg(undefined)).toBe(0);
  });

  it('style 0 sector uses A12 axis on the map', () => {
    const wp: Waypoint = {
      id: 't',
      name: 'TP',
      latitude: 45,
      longitude: 6,
      type: 'turnpoint'
    };
    const leg: CircuitLeg = {
      waypointId: 't',
      role: 'turnpoint',
      obsZone: { cupStyle: 0, r1M: 400, a1Deg: 45, a12Deg: 90, presetId: 'custom' }
    };
    const ctx = {
      legIndex: 0,
      leg,
      waypoint: wp,
      prev: null,
      next: null,
      departure: null,
      defaultRadiusM: 400
    };
    expect(cupZoneReferenceBearingDeg(leg.obsZone!, ctx)).toBe(270);
    const shapes = buildObsZoneMapShapes(ctx);
    expect(shapes[0].kind).toBe('sector');
    expect(shapes[0].startBearingDeg).toBeCloseTo(247.5, 5);
    expect(shapes[0].endBearingDeg).toBeCloseTo(292.5, 5);
  });
});
