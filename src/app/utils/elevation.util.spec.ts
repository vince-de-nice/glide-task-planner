import { describe, it, expect } from 'vitest';
import { resolveLegElevationM, formatTskAltitude } from './elevation.util';
import { Waypoint } from '../models/waypoint.model';
import { CircuitLeg } from '../models/circuit.model';

describe('elevation.util', () => {
  const wp: Waypoint = {
    id: '1',
    name: 'Test',
    latitude: 0,
    longitude: 0,
    type: 'turnpoint',
    elevation: 1200
  };

  it('prefers leg override over waypoint', () => {
    const leg: CircuitLeg = { waypointId: '1', role: 'turnpoint', elevationM: 1500 };
    expect(resolveLegElevationM(wp, leg)).toBe(1500);
  });

  it('formats TSK altitude in meters', () => {
    expect(formatTskAltitude(1234.7)).toBe(1235);
    expect(formatTskAltitude(undefined)).toBe(0);
  });
});
