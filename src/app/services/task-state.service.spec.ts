import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskStateService } from './task-state.service';
import { WaypointService } from './waypoint.service';
import { CupParserService } from './cup-parser.service';

describe('TaskStateService circuit roles', () => {
  let service: TaskStateService;
  let waypointService: WaypointService;
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear()
    });
    TestBed.configureTestingModule({
      providers: [CupParserService, WaypointService, TaskStateService]
    });
    waypointService = TestBed.inject(WaypointService);
    service = TestBed.inject(TaskStateService);
    service.clearSelection();
  });

  function addWp(name: string, type: 'airfield' | 'turnpoint' = 'turnpoint'): string {
    return waypointService.addWaypoint({
      name,
      latitude: 43,
      longitude: 5,
      type
    }).id;
  }

  it('setDeparture places waypoint at start with departure role', () => {
    const home = addWp('home', 'airfield');
    const tp1 = addWp('tp1');
    service.addTurnpoint(tp1);
    service.setDeparture(home);
    expect(service.circuitLegs()).toEqual([
      { waypointId: home, role: 'departure' },
      { waypointId: tp1, role: 'turnpoint' }
    ]);
  });

  it('setArrival places waypoint at end with arrival role', () => {
    const home = addWp('home', 'airfield');
    const tp1 = addWp('tp1');
    service.setDeparture(home);
    service.addTurnpoint(tp1);
    service.setArrival(home);
    expect(service.circuitLegs()).toEqual([
      { waypointId: home, role: 'departure' },
      { waypointId: tp1, role: 'turnpoint' },
      { waypointId: home, role: 'arrival' }
    ]);
    expect(service.getWaypointRoleLabels(home)).toEqual(['Décollage', 'Atterrissage']);
  });

  it('addTurnpoint inserts before arrival', () => {
    const a = addWp('a');
    const mid = addWp('mid');
    const ad = addWp('ad', 'airfield');
    service.setDeparture(ad);
    service.addTurnpoint(mid);
    service.setArrival(ad);
    service.addTurnpoint(a);
    expect(service.circuitLegs()).toEqual([
      { waypointId: ad, role: 'departure' },
      { waypointId: mid, role: 'turnpoint' },
      { waypointId: a, role: 'turnpoint' },
      { waypointId: ad, role: 'arrival' }
    ]);
  });

  it('rejects departure and arrival on non-airfield', () => {
    const tp = addWp('tp');
    expect(service.setDeparture(tp)).toBe(false);
    expect(service.setArrival(tp)).toBe(false);
    expect(service.circuitLegs()).toEqual([]);
  });

  it('setCircuitLegs replaces leg order', () => {
    const a = addWp('a');
    const b = addWp('b');
    const c = addWp('c');
    service.addTurnpoint(a);
    service.addTurnpoint(b);
    service.addTurnpoint(c);
    service.setCircuitLegs([
      { waypointId: c, role: 'turnpoint' },
      { waypointId: a, role: 'turnpoint' },
      { waypointId: b, role: 'turnpoint' }
    ]);
    expect(service.circuitLegs().map(l => l.waypointId)).toEqual([c, a, b]);
  });

  it('removeLastOccurrence and removeAllOccurrences', () => {
    const a = addWp('a');
    const b = addWp('b');
    service.addTurnpoint(a);
    service.addTurnpoint(b);
    service.addTurnpoint(a);
    service.removeLastOccurrence(a);
    expect(service.selectedWaypointIds()).toEqual([a, b]);
    service.removeAllOccurrences(a);
    expect(service.selectedWaypointIds()).toEqual([b]);
  });
});
