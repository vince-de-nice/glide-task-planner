import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { SavedCircuitService } from './saved-circuit.service';
import { WaypointService } from './waypoint.service';
import { TaskStateService } from './task-state.service';
import type { WaypointSnapshot } from '../models/saved-circuit.model';

describe('SavedCircuitService', () => {
  let service: SavedCircuitService;
  let waypointService: WaypointService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [SavedCircuitService, WaypointService, TaskStateService]
    });
    service = TestBed.inject(SavedCircuitService);
    waypointService = TestBed.inject(WaypointService);
    service.circuits.set([]);
  });

  it('previewCircuitLoad marks missing waypoints', () => {
    const snap: WaypointSnapshot = {
      name: 'Lonely Peak',
      latitude: 45.1,
      longitude: 5.2,
      type: 'turnpoint',
      role: 'turnpoint'
    };
    service.circuits.set([
      {
        id: 'c1',
        label: 'Test',
        taskName: 'Test',
        profile: {
          pilotName: '',
          gliderId: '',
          gliderType: '',
          compId: '',
          compClass: '',
          logInterval: 2
        },
        waypoints: [snap, { ...snap, name: 'Other', latitude: 46, longitude: 6 }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]);

    const preview = service.previewCircuitLoad('c1');
    expect(preview).not.toBeNull();
    expect(preview!.legs.every(l => l.status === 'missing')).toBe(true);
    expect(service.hasUnresolvedLegs(preview!)).toBe(true);
  });

  it('applyCircuit with fail policy does not create waypoints', () => {
    const snap: WaypointSnapshot = {
      name: 'Only One',
      latitude: 44,
      longitude: 4,
      type: 'turnpoint',
      role: 'turnpoint'
    };
    service.circuits.set([
      {
        id: 'c2',
        label: 'Solo',
        taskName: 'Solo',
        profile: {
          pilotName: '',
          gliderId: '',
          gliderType: '',
          compId: '',
          compClass: '',
          logInterval: 2
        },
        waypoints: [snap, { ...snap, name: 'Two', latitude: 45, longitude: 5 }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]);

    const before = waypointService.waypoints().length;
    expect(service.applyCircuit('c2', 'fail')).toBeNull();
    expect(waypointService.waypoints().length).toBe(before);
  });

  it('applyCircuit with create policy adds missing waypoints', () => {
    const snap: WaypointSnapshot = {
      name: 'Create Me',
      latitude: 43,
      longitude: 3,
      type: 'turnpoint',
      role: 'turnpoint'
    };
    service.circuits.set([
      {
        id: 'c3',
        label: 'Create',
        taskName: 'Create',
        profile: {
          pilotName: '',
          gliderId: '',
          gliderType: '',
          compId: '',
          compClass: '',
          logInterval: 2
        },
        waypoints: [
          snap,
          { ...snap, name: 'Also', latitude: 43.5, longitude: 3.5, role: 'arrival' }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]);

    const applied = service.applyCircuit('c3', 'create');
    expect(applied).not.toBeNull();
    expect(waypointService.waypoints().length).toBeGreaterThanOrEqual(2);
  });
});
