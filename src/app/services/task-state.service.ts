import { Injectable, computed, inject, signal } from '@angular/core';
import {
  canWaypointBeArrival,
  canWaypointBeDeparture,
  CircuitLeg,
  CircuitLegRole,
  circuitRoleLabel,
  circuitRoleMapToken
} from '../models/circuit.model';
import { Waypoint } from '../models/waypoint.model';
import {
  ObservationZoneConfig,
  defaultObservationZoneForRole,
  normalizeObservationZone
} from '../models/observation-zone.model';
import { WaypointService } from './waypoint.service';
import { defaultTaskName } from './flarm-config.service';
import { DEFAULT_TASK_EXPORT_RADIUS_M } from '../models/task-declaration.model';

import { readMigratedLocalStorage } from '../utils/local-storage-migrate.util';

const STORAGE_KEY = 'gc_task_state';
const LEGACY_STORAGE_KEYS = ['vav_task_state'];

interface PersistedTaskState {
  circuitLegs?: CircuitLeg[];
  /** @deprecated migré vers circuitLegs */
  selectedWaypointIds?: string[];
  taskName: string;
  /** @deprecated — source CUP gérée par CupDatabaseService */
  activeDatabaseId?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class TaskStateService {
  private waypointService = inject(WaypointService);

  circuitLegs = signal<CircuitLeg[]>([]);
  selectedWaypointIds = computed(() => this.circuitLegs().map(leg => leg.waypointId));
  taskName = signal<string>(defaultTaskName());
  /** Rayon par défaut pour les nouvelles zones d’observation (m). */
  defaultZoneRadiusM = signal(DEFAULT_TASK_EXPORT_RADIUS_M);

  selectedCount = computed(() => this.circuitLegs().length);

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const raw = readMigratedLocalStorage(STORAGE_KEY, LEGACY_STORAGE_KEYS);
      if (!raw) return;
      const data = JSON.parse(raw) as PersistedTaskState;
      if (data.circuitLegs?.length) {
        this.circuitLegs.set(this.sanitizeLegs(data.circuitLegs));
      } else if (data.selectedWaypointIds?.length) {
        this.circuitLegs.set(this.inferLegsFromLegacyIds(data.selectedWaypointIds));
      }
      this.taskName.set(data.taskName ?? defaultTaskName());
    } catch {
      /* ignore corrupt state */
    }
  }

  private saveToStorage(): void {
    const data: PersistedTaskState = {
      circuitLegs: this.circuitLegs(),
      taskName: this.taskName()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  private setLegs(legs: CircuitLeg[]): void {
    this.circuitLegs.set(this.sanitizeLegs(legs));
    this.saveToStorage();
  }

  /** Décollage = 1er point aérodrome ; atterrissage = dernier point aérodrome. */
  private sanitizeLegs(legs: CircuitLeg[]): CircuitLeg[] {
    const last = legs.length - 1;
    return legs.map((leg, index) => {
      const wp = this.waypointService.getWaypoint(leg.waypointId);
      let role = leg.role;
      if (leg.role === 'departure') {
        if (!(index === 0 && canWaypointBeDeparture(wp))) {
          role = 'turnpoint';
        }
      } else if (leg.role === 'arrival') {
        if (!(index === last && last > 0 && canWaypointBeArrival(wp))) {
          role = 'turnpoint';
        }
      }
      return this.ensureLegDefaults({ ...leg, role });
    });
  }

  private ensureLegDefaults(leg: CircuitLeg): CircuitLeg {
    const r = this.defaultZoneRadiusM();
    return {
      ...leg,
      obsZone: normalizeObservationZone(
        leg.obsZone ?? defaultObservationZoneForRole(leg.role, r),
        leg.role,
        r
      )
    };
  }

  setDefaultZoneRadiusM(radiusM: number): void {
    const v = Math.min(50000, Math.max(100, Math.round(radiusM)));
    this.defaultZoneRadiusM.set(v);
  }

  updateLegObsZone(index: number, obsZone: ObservationZoneConfig): void {
    const legs = [...this.circuitLegs()];
    if (index < 0 || index >= legs.length) return;
    legs[index] = {
      ...legs[index],
      obsZone: normalizeObservationZone(obsZone, legs[index].role, this.defaultZoneRadiusM())
    };
    this.setLegs(legs);
  }

  updateLegElevation(index: number, elevationM: number | undefined): void {
    const legs = [...this.circuitLegs()];
    if (index < 0 || index >= legs.length) return;
    const elev =
      elevationM != null && Number.isFinite(elevationM) ? Math.round(elevationM) : undefined;
    legs[index] = { ...legs[index], elevationM: elev };
    this.setLegs(legs);
  }

  applyDefaultRadiusToAllLegZones(): void {
    const r = this.defaultZoneRadiusM();
    const legs = this.circuitLegs().map(leg =>
      this.ensureLegDefaults({
        ...leg,
        obsZone: defaultObservationZoneForRole(leg.role, r)
      })
    );
    this.setLegs(legs);
  }

  canSetDeparture(waypointId: string): boolean {
    return canWaypointBeDeparture(this.waypointService.getWaypoint(waypointId));
  }

  canSetArrival(waypointId: string): boolean {
    return canWaypointBeArrival(this.waypointService.getWaypoint(waypointId));
  }

  /** Migration : 1er = décollage si aérodrome, dernier = atterrissage si aérodrome, sinon virage. */
  private inferLegsFromLegacyIds(ids: string[]): CircuitLeg[] {
    return ids.map((waypointId, index) =>
      this.ensureLegDefaults({
        waypointId,
        role: this.inferLegacyRole(waypointId, index, ids.length)
      })
    );
  }

  private inferLegacyRole(waypointId: string, index: number, count: number): CircuitLegRole {
    const wp = this.waypointService.getWaypoint(waypointId);
    const isAirfield = wp?.type === 'airfield';
    if (index === 0 && isAirfield) return 'departure';
    if (index === count - 1 && isAirfield && count > 1) return 'arrival';
    if (count === 1 && isAirfield) return 'departure';
    return 'turnpoint';
  }

  inferLegsFromWaypointIds(ids: string[]): CircuitLeg[] {
    return this.inferLegsFromLegacyIds(ids);
  }

  setTaskName(name: string): void {
    this.taskName.set(name);
    this.saveToStorage();
  }

  getOccurrenceCount(id: string): number {
    return this.circuitLegs().filter(leg => leg.waypointId === id).length;
  }

  getCircuitIndices(id: string): number[] {
    const indices: number[] = [];
    this.circuitLegs().forEach((leg, index) => {
      if (leg.waypointId === id) indices.push(index + 1);
    });
    return indices;
  }

  getLegAt(index: number): CircuitLeg | undefined {
    return this.circuitLegs()[index];
  }

  getCircuitRoles(): CircuitLegRole[] {
    return this.circuitLegs().map(leg => leg.role);
  }

  /** Libellés français pour chaque occurrence du waypoint dans le circuit. */
  getWaypointRoleLabels(waypointId: string): string[] {
    return this.circuitLegs()
      .filter(leg => leg.waypointId === waypointId)
      .map(leg => circuitRoleLabel(leg.role));
  }

  /** Tokens affichés sur la carte (decollage, atterrissage, numéros de position). */
  getWaypointMapRoleTokens(waypointId: string): string[] {
    return this.circuitLegs()
      .map((leg, index) => (leg.waypointId === waypointId ? circuitRoleMapToken(leg.role, index + 1) : null))
      .filter((token): token is string => token !== null);
  }

  /** @deprecated Utiliser getWaypointRoleLabels */
  getAirfieldRoleLabels(waypointId: string): string[] {
    return this.getWaypointRoleLabels(waypointId);
  }

  setDeparture(waypointId: string): boolean {
    if (!this.canSetDeparture(waypointId)) return false;
    let legs = this.circuitLegs().filter(leg => leg.role !== 'departure');
    legs = legs.filter(
      leg => !(leg.waypointId === waypointId && leg.role === 'turnpoint')
    );
    legs.unshift(
      this.ensureLegDefaults({
        waypointId,
        role: 'departure',
        obsZone: defaultObservationZoneForRole('departure', this.defaultZoneRadiusM())
      })
    );
    this.setLegs(legs);
    return true;
  }

  setArrival(waypointId: string): boolean {
    if (!this.canSetArrival(waypointId)) return false;
    let legs = this.circuitLegs().filter(leg => leg.role !== 'arrival');
    legs = legs.filter(
      leg => !(leg.waypointId === waypointId && leg.role === 'turnpoint')
    );
    legs.push(
      this.ensureLegDefaults({
        waypointId,
        role: 'arrival',
        obsZone: defaultObservationZoneForRole('arrival', this.defaultZoneRadiusM())
      })
    );
    this.setLegs(legs);
    return true;
  }

  addTurnpoint(waypointId: string): void {
    const legs = [...this.circuitLegs()];
    const arrivalIndex = legs.findIndex(leg => leg.role === 'arrival');
    const leg: CircuitLeg = this.ensureLegDefaults({
      waypointId,
      role: 'turnpoint',
      obsZone: defaultObservationZoneForRole('turnpoint', this.defaultZoneRadiusM())
    });
    if (arrivalIndex >= 0) {
      legs.splice(arrivalIndex, 0, leg);
    } else {
      legs.push(leg);
    }
    this.setLegs(legs);
  }

  /** @deprecated Préférer addTurnpoint */
  addWaypoint(id: string): void {
    this.addTurnpoint(id);
  }

  getLastOccurrenceIndex(waypointId: string): number {
    const legs = this.circuitLegs();
    for (let i = legs.length - 1; i >= 0; i--) {
      if (legs[i].waypointId === waypointId) return i;
    }
    return -1;
  }

  removeLastOccurrence(waypointId: string): void {
    const index = this.getLastOccurrenceIndex(waypointId);
    if (index >= 0) this.removeWaypointAt(index);
  }

  removeAllOccurrences(waypointId: string): void {
    const legs = this.circuitLegs().filter(leg => leg.waypointId !== waypointId);
    if (legs.length === this.circuitLegs().length) return;
    this.setLegs(legs);
  }

  removeWaypointAt(index: number): void {
    const legs = [...this.circuitLegs()];
    if (index < 0 || index >= legs.length) return;
    legs.splice(index, 1);
    this.setLegs(legs);
  }

  moveWaypoint(index: number, direction: 'up' | 'down'): void {
    const legs = [...this.circuitLegs()];
    if (direction === 'up' && index > 0) {
      [legs[index], legs[index - 1]] = [legs[index - 1], legs[index]];
    } else if (direction === 'down' && index < legs.length - 1) {
      [legs[index], legs[index + 1]] = [legs[index + 1], legs[index]];
    } else {
      return;
    }
    this.normalizeDepartureArrivalPositions(legs);
    this.setLegs(legs);
  }

  /** Après réordonnancement manuel, le décollage reste en tête et l'atterrissage en queue. */
  private normalizeDepartureArrivalPositions(legs: CircuitLeg[]): void {
    const departure = legs.find(leg => leg.role === 'departure');
    const arrival = legs.find(leg => leg.role === 'arrival');
    const middle = legs.filter(leg => leg.role === 'turnpoint');
    const ordered: CircuitLeg[] = [];
    if (departure) ordered.push(departure);
    ordered.push(...middle);
    if (arrival) ordered.push(arrival);
    legs.splice(0, legs.length, ...ordered);
  }

  setCircuitLegs(legs: CircuitLeg[]): void {
    this.setLegs(legs);
  }

  clearSelection(): void {
    this.circuitLegs.set([]);
    this.saveToStorage();
  }

  loadTask(legs: CircuitLeg[], name: string): void {
    this.circuitLegs.set(this.sanitizeLegs([...legs]));
    this.taskName.set(name);
    this.saveToStorage();
  }

  /** Charge une liste d'IDs sans rôles (circuits enregistrés anciens format). */
  loadTaskFromWaypointIds(waypointIds: string[], name: string): void {
    this.loadTask(this.inferLegsFromLegacyIds(waypointIds), name);
  }

  resetTaskNameToToday(): void {
    this.setTaskName(defaultTaskName());
  }
}
