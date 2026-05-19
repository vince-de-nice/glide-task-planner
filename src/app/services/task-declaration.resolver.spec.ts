import { describe, it, expect } from 'vitest';
import { TaskDeclarationResolver } from './task-declaration.resolver';
import { CircuitLeg } from '../models/circuit.model';
import { Waypoint } from '../models/waypoint.model';

describe('TaskDeclarationResolver', () => {
  const resolver = new TaskDeclarationResolver();

  const ad: Waypoint = {
    id: 'a1',
    name: 'Lasham',
    latitude: 51.18765,
    longitude: -1.0444,
    type: 'airfield'
  };

  const tp1: Waypoint = {
    id: 't1',
    name: 'Sarnesfield',
    latitude: 52.15153,
    longitude: -2.92045,
    type: 'turnpoint'
  };

  const legs: CircuitLeg[] = [
    { waypointId: 'a1', role: 'departure' },
    { waypointId: 't1', role: 'turnpoint' },
    { waypointId: 'a1', role: 'arrival' }
  ];

  it('maps departure to takeoff+start and arrival to finish+landing', () => {
    const map = new Map([
      ['a1', ad],
      ['t1', tp1]
    ]);
    const decl = resolver.resolve(legs, map, 'Triangle test');
    const roles = decl.points.map(p => p.role);
    expect(roles).toContain('takeoff');
    expect(roles).toContain('start');
    expect(roles).toContain('turn');
    expect(roles).toContain('finish');
    expect(roles).toContain('landing');
    expect(resolver.countTurnPoints(legs)).toBe(1);
  });
});
