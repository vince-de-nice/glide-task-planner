import { Injectable, computed, inject, signal } from '@angular/core';
import {
  canWaypointBeArrival,
  canWaypointBeDeparture,
  CircuitLeg,
  CircuitLegRole,
  circuitRoleMapToken
} from '../models/circuit.model';
import { circuitRoleLabelI18n } from '../i18n/display-i18n.util';
import { TranslateService } from '../i18n/translate.service';
import {
  ObservationZoneConfig,
  normalizeObservationZone,
  observationZoneFromPreset
} from '../models/observation-zone.model';
import {
  DEFAULT_SAFETY_PARAMS,
  SafetyParams,
  sanitizeSafetyParams
} from '../models/safety-params.model';
import { WaypointService } from './waypoint.service';
import { defaultTaskName } from './flarm-config.service';
import {
  DEFAULT_TASK_REGULATION,
  TaskRegulationState,
  TaskRuleRadiiM
} from '../models/task-rule-profile.model';
import { TaskRuleEngineService } from './task-rule-engine.service';

import { readMigratedLocalStorage } from '../utils/local-storage-migrate.util';

const STORAGE_KEY = 'gc_task_state';
const LEGACY_STORAGE_KEYS = ['vav_task_state'];

interface PersistedTaskState {
  circuitLegs?: CircuitLeg[];
  /** @deprecated migré vers circuitLegs */
  selectedWaypointIds?: string[];
  taskName: string;
  regulation?: TaskRegulationState;
  safetyParams?: SafetyParams;
  /** @deprecated — source CUP gérée par CupDatabaseService */
  activeDatabaseId?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class TaskStateService {
  private waypointService = inject(WaypointService);
  private ruleEngine = inject(TaskRuleEngineService);
  private i18n = inject(TranslateService);

  circuitLegs = signal<CircuitLeg[]>([]);
  selectedWaypointIds = computed(() => this.circuitLegs().map(leg => leg.waypointId));
  taskName = signal<string>(defaultTaskName());
  regulation = signal<TaskRegulationState>({ ...DEFAULT_TASK_REGULATION });
  safetyParams = signal<SafetyParams>({ ...DEFAULT_SAFETY_PARAMS });

  readonly resolvedRegulation = computed(() =>
    this.ruleEngine.resolveRegulation(this.regulation())
  );

  /** Rayon par défaut pour les nouvelles zones (virage) — rétrocompat UI. */
  defaultZoneRadiusM = computed(() => this.resolvedRegulation().radiiM.turnpointM);

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
      if (data.regulation?.profileId) {
        this.regulation.set({
          profileId: data.regulation.profileId,
          overrides: data.regulation.overrides ?? {}
        });
      }
      if (data.safetyParams) {
        this.safetyParams.set(sanitizeSafetyParams(data.safetyParams));
      }
    } catch {
      /* ignore corrupt state */
    }
  }

  private saveToStorage(): void {
    const data: PersistedTaskState = {
      circuitLegs: this.circuitLegs(),
      taskName: this.taskName(),
      regulation: this.regulation(),
      safetyParams: this.safetyParams()
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
    const reg = this.resolvedRegulation();
    const r = this.ruleEngine.radiusForLegRole(reg, leg.role);
    const preset = reg.obsZonePresetByRole[leg.role];
    const defaultZone =
      leg.obsZone ?? observationZoneFromPreset(preset, r);
    return {
      ...leg,
      obsZone: normalizeObservationZone(defaultZone, leg.role, r)
    };
  }

  setDefaultZoneRadiusM(radiusM: number): void {
    this.setRadiiM({ turnpointM: radiusM });
  }

  setRadiiM(patch: Partial<TaskRuleRadiiM>): void {
    const reg = this.resolvedRegulation();
    this.regulation.update(s => ({
      ...s,
      overrides: {
        ...s.overrides,
        radiiM: { ...reg.radiiM, ...patch }
      }
    }));
    this.saveToStorage();
  }

  setRegulation(state: TaskRegulationState): void {
    this.regulation.set(state);
    this.saveToStorage();
  }

  setRegulationProfile(profileId: TaskRegulationState['profileId']): void {
    this.regulation.set({ profileId, overrides: {} });
    this.saveToStorage();
  }

  applyRegulationToAllLegs(): void {
    const legs = this.ruleEngine.applyProfileToLegs(
      this.circuitLegs(),
      this.resolvedRegulation()
    );
    this.setLegs(legs);
  }

  /** Met à jour zone d’observation et altitude d’un point en une seule écriture. */
  patchLegZone(
    index: number,
    patch: { obsZone?: ObservationZoneConfig; elevationM?: number | undefined }
  ): void {
    const legs = [...this.circuitLegs()];
    if (index < 0 || index >= legs.length) return;
    const leg = legs[index];
    const r = this.ruleEngine.radiusForLegRole(this.resolvedRegulation(), leg.role);
    const next: CircuitLeg = { ...leg };
    if (patch.obsZone !== undefined) {
      next.obsZone = normalizeObservationZone(patch.obsZone, leg.role, r);
    }
    if (patch.elevationM !== undefined) {
      next.elevationM =
        patch.elevationM != null && Number.isFinite(patch.elevationM)
          ? Math.round(patch.elevationM)
          : undefined;
    }
    legs[index] = next;
    this.setLegs(legs);
  }

  updateLegObsZone(index: number, obsZone: ObservationZoneConfig): void {
    this.patchLegZone(index, { obsZone });
  }

  updateLegElevation(index: number, elevationM: number | undefined): void {
    this.patchLegZone(index, { elevationM });
  }

  /** Branche `branchIndex` = segment du point `branchIndex` vers `branchIndex + 1`. */
  isSafetyLandableEnabled(branchIndex: number, landableId: string): boolean {
    const legs = this.circuitLegs();
    if (branchIndex < 0 || branchIndex >= legs.length - 1) return true;
    const disabled = legs[branchIndex].safetyOutgoing?.disabledLandableIds;
    return !disabled?.includes(landableId);
  }

  setSafetyLandableEnabled(
    branchIndex: number,
    landableId: string,
    enabled: boolean
  ): void {
    const legs = [...this.circuitLegs()];
    if (branchIndex < 0 || branchIndex >= legs.length - 1) return;
    const leg = legs[branchIndex];
    const disabled = new Set(leg.safetyOutgoing?.disabledLandableIds ?? []);
    if (enabled) {
      disabled.delete(landableId);
    } else {
      disabled.add(landableId);
    }
    const disabledLandableIds = [...disabled];
    legs[branchIndex] = {
      ...leg,
      safetyOutgoing:
        disabledLandableIds.length > 0 ? { disabledLandableIds } : undefined
    };
    this.setLegs(legs);
  }

  setAllSafetyLandablesEnabled(
    branchIndex: number,
    landableIds: string[],
    enabled: boolean
  ): void {
    const legs = [...this.circuitLegs()];
    if (branchIndex < 0 || branchIndex >= legs.length - 1) return;
    const leg = legs[branchIndex];
    const disabled = new Set(leg.safetyOutgoing?.disabledLandableIds ?? []);
    for (const id of landableIds) {
      if (enabled) disabled.delete(id);
      else disabled.add(id);
    }
    const disabledLandableIds = [...disabled];
    legs[branchIndex] = {
      ...leg,
      safetyOutgoing:
        disabledLandableIds.length > 0 ? { disabledLandableIds } : undefined
    };
    this.setLegs(legs);
  }

  applyDefaultRadiusToAllLegZones(): void {
    this.applyRegulationToAllLegs();
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

  setSafetyParams(patch: Partial<SafetyParams>): void {
    const next = sanitizeSafetyParams(patch, this.safetyParams());
    this.safetyParams.set(next);
    this.saveToStorage();
  }

  resetSafetyParams(): void {
    this.safetyParams.set({ ...DEFAULT_SAFETY_PARAMS });
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

  /** Libellés localisés pour chaque occurrence du waypoint dans le circuit. */
  getWaypointRoleLabels(waypointId: string): string[] {
    return this.circuitLegs()
      .filter(leg => leg.waypointId === waypointId)
      .map(leg => circuitRoleLabelI18n(leg.role, this.i18n));
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
        obsZone: observationZoneFromPreset(
          this.resolvedRegulation().obsZonePresetByRole.departure,
          this.ruleEngine.radiusForLegRole(this.resolvedRegulation(), 'departure')
        )
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
        obsZone: observationZoneFromPreset(
          this.resolvedRegulation().obsZonePresetByRole.arrival,
          this.ruleEngine.radiusForLegRole(this.resolvedRegulation(), 'arrival')
        )
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
      obsZone: observationZoneFromPreset(
        this.resolvedRegulation().obsZonePresetByRole.turnpoint,
        this.ruleEngine.radiusForLegRole(this.resolvedRegulation(), 'turnpoint')
      )
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

  loadTask(
    legs: CircuitLeg[],
    name: string,
    regulation?: TaskRegulationState,
    safetyParams?: SafetyParams
  ): void {
    this.circuitLegs.set(this.sanitizeLegs([...legs]));
    this.taskName.set(name);
    if (regulation) {
      this.regulation.set(regulation);
    }
    this.safetyParams.set(
      safetyParams ? sanitizeSafetyParams(safetyParams) : { ...DEFAULT_SAFETY_PARAMS }
    );
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
