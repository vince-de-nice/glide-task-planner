import { ObservationZoneConfig } from './observation-zone.model';
import { CircuitLegRole } from './circuit.model';

/** Rôle d’un point dans une déclaration de tâche (formats IGC / TSK / CUP). */
export type TaskDeclarationPointRole =
  | 'takeoff'
  | 'start'
  | 'turn'
  | 'finish'
  | 'landing';

export interface TaskDeclarationPoint {
  name: string;
  latitude: number;
  longitude: number;
  role: TaskDeclarationPointRole;
  /** Nom exact du waypoint CUP (champ `name`). */
  cupName: string;
  /** @deprecated Préférer obsZone.r1M */
  radiusM?: number;
  /** Altitude MSL (m) pour export TSK / CUP */
  elevationM?: number;
  obsZone?: ObservationZoneConfig;
  circuitRole?: CircuitLegRole;
}

export interface TaskDeclaration {
  taskName: string;
  declaredAtUtc: Date;
  points: TaskDeclarationPoint[];
  warnings: string[];
}

export interface TaskExportOptions {
  defaultRadiusM: number;
  declarationTimeUtc?: Date;
}

export const DEFAULT_TASK_EXPORT_RADIUS_M = 400;
