import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskStateService } from './task-state.service';

describe('TaskStateService circuit labels', () => {
  let service: TaskStateService;
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear()
    });
    service = new TaskStateService();
    service.clearSelection();
  });

  it('returns comma-separated 1-based indices', () => {
    service.addWaypoint('a');
    service.addWaypoint('b');
    service.addWaypoint('a');
    expect(service.getCircuitIndices('a')).toEqual([1, 3]);
    expect(service.getCircuitIndices('b')).toEqual([2]);
  });

  it('labels airfield at start and end', () => {
    service.addWaypoint('home');
    service.addWaypoint('tp1');
    service.addWaypoint('home');
    expect(service.getAirfieldRoleLabels('home')).toEqual(['Décollage', 'Atterrissage']);
    expect(service.getAirfieldRoleLabels('tp1')).toEqual([]);
  });

  it('single airfield is both décollage and atterrissage', () => {
    service.addWaypoint('home');
    expect(service.getAirfieldRoleLabels('home')).toEqual(['Décollage', 'Atterrissage']);
  });

  it('removeLastOccurrence and removeAllOccurrences', () => {
    service.addWaypoint('a');
    service.addWaypoint('b');
    service.addWaypoint('a');
    expect(service.getLastOccurrenceIndex('a')).toBe(2);
    service.removeLastOccurrence('a');
    expect(service.selectedWaypointIds()).toEqual(['a', 'b']);
    service.removeAllOccurrences('a');
    expect(service.selectedWaypointIds()).toEqual(['b']);
  });
});
