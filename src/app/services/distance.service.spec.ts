import { describe, it, expect } from 'vitest';
import { DistanceService } from './distance.service';
import { Waypoint } from '../models/waypoint.model';

const wp = (
  name: string,
  lat: number,
  lon: number,
  type: Waypoint['type'] = 'turnpoint'
): Waypoint => ({
  id: name,
  name,
  latitude: lat,
  longitude: lon,
  type
});

describe('DistanceService.calculateTaskDistance', () => {
  const service = new DistanceService();

  it('excludes first leg from departure airfield and last leg to arrival', () => {
    const waypoints = [
      wp('Vinon', 43.74, 5.78, 'airfield'),
      wp('Rians', 43.61, 5.76),
      wp('Gap', 43.92, 6.08),
      wp('Vinon', 43.74, 5.78, 'airfield')
    ];

    const result = service.calculateTaskDistance(waypoints, 'km');
    expect(result.legDistances).toHaveLength(3);
    expect(result.legDistances[0].counted).toBe(false);
    expect(result.legDistances[0].exclusionReason).toBe('departure');
    expect(result.legDistances[1].counted).toBe(true);
    expect(result.legDistances[2].counted).toBe(false);
    expect(result.legDistances[2].exclusionReason).toBe('arrival');
    expect(result.taskDistance).toBeCloseTo(result.legDistances[1].distance, 5);
    expect(result.totalDistance).toBeGreaterThan(result.taskDistance);
  });

  it('counts all legs when no airfield at ends', () => {
    const waypoints = [wp('A', 43, 5), wp('B', 44, 6), wp('C', 45, 7)];
    const result = service.calculateTaskDistance(waypoints, 'km');
    expect(result.taskDistance).toBeCloseTo(result.totalDistance, 5);
    expect(result.legDistances.every(l => l.counted)).toBe(true);
  });

  it('ignores departure/arrival roles on non-airfield endpoints', () => {
    const waypoints = [
      wp('L1', 43.74, 5.78, 'landable'),
      wp('TP1', 43.61, 5.76),
      wp('TP2', 43.92, 6.08),
      wp('L2', 43.5, 5.9, 'landable')
    ];
    const result = service.calculateTaskDistance(waypoints, 'km', [
      'departure',
      'turnpoint',
      'turnpoint',
      'arrival'
    ]);
    expect(result.taskDistance).toBeCloseTo(result.totalDistance, 5);
    expect(result.legDistances.every(l => l.counted)).toBe(true);
  });

  it('counts middle airfield legs', () => {
    const waypoints = [
      wp('AD1', 43.74, 5.78, 'airfield'),
      wp('TP1', 43.61, 5.76),
      wp('AD2', 43.5, 5.9, 'airfield'),
      wp('TP2', 43.92, 6.08),
      wp('AD3', 43.74, 5.78, 'airfield')
    ];
    const result = service.calculateTaskDistance(waypoints, 'km');
    expect(result.legDistances[1].counted).toBe(true);
    expect(result.legDistances[2].counted).toBe(true);
  });
});
