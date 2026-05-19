import { CircuitLegRole } from './circuit.model';
import { ObsZonePresetId } from './observation-zone.model';

export type TaskRuleProfileId =
  | 'club'
  | 'seeyou_standard'
  | 'fai_line_pev'
  | 'fai_cylinder_start'
  | 'custom';

export type TaskStartKind = 'line' | 'cylinder';

export type TaskRuleConstraintId =
  | 'require_airfield_departure'
  | 'require_airfield_arrival'
  | 'departure_must_be_line'
  | 'arrival_must_be_line'
  | 'departure_must_be_cylinder'
  | 'min_turnpoints'
  | 'pev_wait_window_range';

export interface TaskRuleRadiiM {
  departureM: number;
  turnpointM: number;
  arrivalM: number;
}

export interface CupTaskOptionsConfig {
  /** null = auto selon présence aérodrome départ/arrivée */
  beforePts?: number | null;
  afterPts?: number | null;
  wpDis?: boolean;
  nearDisM?: number;
  nearAltM?: number;
  /** HH:MM:SS UTC */
  noStart?: string | null;
  /** HH:MM:SS durée désignée */
  taskTime?: string | null;
}

export interface TaskStartFaiConfig {
  startKind: TaskStartKind;
  pevEnabled: boolean;
  pevWaitMin: number;
  pevWindowMin: number;
  cylinderMinRadiusM: number;
  maxStartGroundSpeedKmh?: number;
}

export interface TaskRuleProfileDefinition {
  id: TaskRuleProfileId;
  label: string;
  description: string;
  radiiM: TaskRuleRadiiM;
  obsZonePresetByRole: Record<CircuitLegRole, ObsZonePresetId>;
  cupOptions: CupTaskOptionsConfig;
  startFai: TaskStartFaiConfig;
  constraints: TaskRuleConstraintId[];
  /** Profil club : export autorisé malgré erreurs si l'utilisateur confirme */
  allowExportDespiteErrors?: boolean;
}

/** Surcharges utilisateur (profil custom ou ajustements). */
export interface TaskRegulationOverrides {
  radiiM?: Partial<TaskRuleRadiiM>;
  cupOptions?: Partial<CupTaskOptionsConfig>;
  startFai?: Partial<TaskStartFaiConfig>;
  /** Contraintes actives en mode custom */
  constraints?: TaskRuleConstraintId[];
}

export interface TaskRegulationState {
  profileId: TaskRuleProfileId;
  overrides: TaskRegulationOverrides;
}

export interface ResolvedTaskRegulation {
  profileId: TaskRuleProfileId;
  label: string;
  description: string;
  radiiM: TaskRuleRadiiM;
  obsZonePresetByRole: Record<CircuitLegRole, ObsZonePresetId>;
  cupOptions: CupTaskOptionsConfig;
  startFai: TaskStartFaiConfig;
  constraints: TaskRuleConstraintId[];
  allowExportDespiteErrors: boolean;
}

export const DEFAULT_TASK_REGULATION: TaskRegulationState = {
  profileId: 'club',
  overrides: {}
};

export const FAI_PEV_MIN_MINUTES = 5;
export const FAI_PEV_MAX_MINUTES = 10;
export const FAI_CYLINDER_START_MIN_RADIUS_M = 10_000;

const BASE_CLUB: Omit<TaskRuleProfileDefinition, 'id'> = {
  label: 'Club (libre)',
  description:
    'Lignes de départ/arrivée par défaut, aérodromes recommandés. Export possible avec avertissements.',
  radiiM: { departureM: 400, turnpointM: 400, arrivalM: 400 },
  obsZonePresetByRole: {
    departure: 'start_line',
    turnpoint: 'cylinder_fixed',
    arrival: 'finish_line'
  },
  cupOptions: {
    beforePts: null,
    afterPts: null,
    wpDis: false,
    nearDisM: 70,
    nearAltM: 300
  },
  startFai: {
    startKind: 'line',
    pevEnabled: false,
    pevWaitMin: 5,
    pevWindowMin: 10,
    cylinderMinRadiusM: FAI_CYLINDER_START_MIN_RADIUS_M
  },
  constraints: [],
  allowExportDespiteErrors: true
};

export const TASK_RULE_PROFILES: Record<TaskRuleProfileId, TaskRuleProfileDefinition> = {
  club: { id: 'club', ...BASE_CLUB },
  seeyou_standard: {
    id: 'seeyou_standard',
    label: 'SeeYou standard',
    description: 'Options CUP classiques : WpDis=False, tolérances NearDis/NearAlt, lignes départ/arrivée.',
    radiiM: { departureM: 500, turnpointM: 500, arrivalM: 500 },
    obsZonePresetByRole: {
      departure: 'start_line',
      turnpoint: 'cylinder_fixed',
      arrival: 'finish_line'
    },
    cupOptions: {
      beforePts: null,
      afterPts: null,
      wpDis: false,
      nearDisM: 700,
      nearAltM: 300
    },
    startFai: {
      startKind: 'line',
      pevEnabled: false,
      pevWaitMin: 5,
      pevWindowMin: 10,
      cylinderMinRadiusM: FAI_CYLINDER_START_MIN_RADIUS_M
    },
    constraints: ['departure_must_be_line', 'arrival_must_be_line'],
    allowExportDespiteErrors: false
  },
  fai_line_pev: {
    id: 'fai_line_pev',
    label: 'FAI — Ligne + PEV',
    description:
      'Championnat : aérodromes obligatoires, ligne de départ, PEV 5–10 min (Annexe A §7.4.3).',
    radiiM: { departureM: 5000, turnpointM: 500, arrivalM: 5000 },
    obsZonePresetByRole: {
      departure: 'start_line',
      turnpoint: 'cylinder_fixed',
      arrival: 'finish_line'
    },
    cupOptions: {
      beforePts: 2,
      afterPts: 2,
      wpDis: false,
      nearDisM: 500,
      nearAltM: 300
    },
    startFai: {
      startKind: 'line',
      pevEnabled: true,
      pevWaitMin: 5,
      pevWindowMin: 10,
      cylinderMinRadiusM: FAI_CYLINDER_START_MIN_RADIUS_M,
      maxStartGroundSpeedKmh: 180
    },
    constraints: [
      'require_airfield_departure',
      'require_airfield_arrival',
      'departure_must_be_line',
      'min_turnpoints',
      'pev_wait_window_range'
    ],
    allowExportDespiteErrors: false
  },
  fai_cylinder_start: {
    id: 'fai_cylinder_start',
    label: 'FAI — Cylindre départ',
    description: 'Démarrage cylindre ≥ 10 km (Annexe A §7.4.4), PEV possible, aérodromes obligatoires.',
    radiiM: { departureM: FAI_CYLINDER_START_MIN_RADIUS_M, turnpointM: 500, arrivalM: 5000 },
    obsZonePresetByRole: {
      departure: 'start_cylinder_fai',
      turnpoint: 'cylinder_fixed',
      arrival: 'finish_line'
    },
    cupOptions: {
      beforePts: 2,
      afterPts: 2,
      wpDis: false,
      nearDisM: 500,
      nearAltM: 300
    },
    startFai: {
      startKind: 'cylinder',
      pevEnabled: true,
      pevWaitMin: 5,
      pevWindowMin: 10,
      cylinderMinRadiusM: FAI_CYLINDER_START_MIN_RADIUS_M,
      maxStartGroundSpeedKmh: 180
    },
    constraints: [
      'require_airfield_departure',
      'require_airfield_arrival',
      'departure_must_be_cylinder',
      'min_turnpoints',
      'pev_wait_window_range'
    ],
    allowExportDespiteErrors: false
  },
  custom: {
    id: 'custom',
    label: 'Personnalisé',
    description: 'Paramètres et contraintes définis par l’organisateur.',
    radiiM: { departureM: 400, turnpointM: 400, arrivalM: 400 },
    obsZonePresetByRole: {
      departure: 'start_line',
      turnpoint: 'cylinder_fixed',
      arrival: 'finish_line'
    },
    cupOptions: {
      beforePts: null,
      afterPts: null,
      wpDis: false,
      nearDisM: 700,
      nearAltM: 300,
      noStart: null,
      taskTime: null
    },
    startFai: {
      startKind: 'line',
      pevEnabled: false,
      pevWaitMin: 5,
      pevWindowMin: 10,
      cylinderMinRadiusM: FAI_CYLINDER_START_MIN_RADIUS_M
    },
    constraints: [],
    allowExportDespiteErrors: false
  }
};

export function radiusForRole(radii: TaskRuleRadiiM, role: CircuitLegRole): number {
  switch (role) {
    case 'departure':
      return radii.departureM;
    case 'arrival':
      return radii.arrivalM;
    default:
      return radii.turnpointM;
  }
}
