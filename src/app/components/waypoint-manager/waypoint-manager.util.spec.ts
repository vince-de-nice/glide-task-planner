import { describe, it, expect } from 'vitest';
import { filterWaypoints, paginateWaypoints, sortWaypoints } from './waypoint-manager.util';
import { Waypoint } from '../../models/waypoint.model';

const sample: Waypoint[] = [
  { id: 'b', name: 'Bravo', type: 'turnpoint', latitude: 46, longitude: 6, elevation: 1000 },
  { id: 'a', name: 'Alpha', type: 'airfield', latitude: 45, longitude: 5, elevation: 500 },
  { id: 'c', name: 'Charlie', type: 'landable', latitude: 47, longitude: 7 }
];

describe('waypoint-manager.util', () => {
  it('filters by name or code', () => {
    const filtered = filterWaypoints(sample, 'alpha');
    expect(filtered.map(w => w.id)).toEqual(['a']);
  });

  it('returns all waypoints when query is empty', () => {
    expect(filterWaypoints(sample, '  ')).toHaveLength(3);
  });

  it('sorts by name ascending', () => {
    const sorted = sortWaypoints(sample, 'name', 'asc');
    expect(sorted.map(w => w.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('sorts by elevation with missing values last when ascending', () => {
    const sorted = sortWaypoints(sample, 'elevation', 'asc');
    expect(sorted.map(w => w.id)).toEqual(['a', 'b', 'c']);
  });

  it('paginates sorted list', () => {
    const sorted = sortWaypoints(sample, 'name', 'asc');
    const page = paginateWaypoints(sorted, 2, 2);
    expect(page).toHaveLength(1);
    expect(page[0].name).toBe('Charlie');
  });
});
