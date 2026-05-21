import { CircuitLegRole } from './circuit.model';
import { ObservationZoneConfig } from './observation-zone.model';
import { FlarmProfile } from './flarm-profile.model';
import { TaskRegulationState } from './task-rule-profile.model';
import { WaypointType } from './waypoint.model';

/** Point de passage figé dans un circuit (réutilisable sur un autre poste / pilote). */
export interface WaypointSnapshot {
  sourceId?: string;
  name: string;
  code?: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  type: WaypointType;
  /** Rôle dans le circuit au moment de l'enregistrement */
  role?: CircuitLegRole;
  obsZone?: ObservationZoneConfig;
  /** Altitude MSL (m) pour la tâche */
  elevationM?: number;
}

export interface SavedCircuit {
  id: string;
  /** Nom affiché dans la bibliothèque (ex. « 500 km Vinon ») */
  label: string;
  taskName: string;
  regulation?: TaskRegulationState;
  profile: FlarmProfile;
  waypoints: WaypointSnapshot[];
  /** @deprecated */
  databaseId?: string | null;
  sourceUrl?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedCircuitExport {
  version: 1 | 2;
  exportedAt: string;
  circuits: SavedCircuit[];
}

export type WaypointMatchKind = 'sourceId' | 'coords' | 'code' | 'name';

export interface CircuitLoadLegPreview {
  snap: WaypointSnapshot;
  status: 'matched' | 'missing';
  matchKind?: WaypointMatchKind;
  waypointName?: string;
}

export interface CircuitLoadPreview {
  circuitId: string;
  label: string;
  taskName: string;
  sourceUrl: string | null;
  legs: CircuitLoadLegPreview[];
}

export type CircuitUnresolvedPolicy = 'create' | 'fail';
