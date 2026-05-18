import { CircuitLegRole } from './circuit.model';
import { FlarmProfile } from './flarm-profile.model';
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
}

export interface SavedCircuit {
  id: string;
  /** Nom affiché dans la bibliothèque (ex. « 500 km Vinon ») */
  label: string;
  taskName: string;
  profile: FlarmProfile;
  waypoints: WaypointSnapshot[];
  databaseId?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedCircuitExport {
  version: 1;
  exportedAt: string;
  circuits: SavedCircuit[];
}
