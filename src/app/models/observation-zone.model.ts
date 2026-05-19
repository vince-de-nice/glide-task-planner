import { CircuitLegRole } from './circuit.model';

/**
 * Zone d’observation d’un point de tâche (SeeYou CUP ObsZone + export XCSoar).
 * @see https://github.com/naviter/seeyou_file_formats/blob/main/CUP_file_format.md
 */
export interface ObservationZoneConfig {
  /** Identifiant de préréglage (UI) */
  presetId?: ObsZonePresetId;
  /**
   * CUP Style — orientation de la zone :
   * 0 fixe, 1 symétrique, 2 vers point suivant, 3 vers précédent, 4 vers départ
   */
  cupStyle: 0 | 1 | 2 | 3 | 4;
  /** Rayon principal R1 (m) */
  r1M: number;
  /** Angle A1 (°) — secteurs, lignes */
  a1Deg?: number;
  /** Rayon intérieur R2 (m) — secteur FAI / keyhole */
  r2M?: number;
  /** Angle A2 (°) */
  a2Deg?: number;
  /** Angle A12 (°) — secteur combiné SeeYou */
  a12Deg?: number;
  /** Ligne de départ / arrivée (CUP `Line=1`) */
  line?: boolean;
}

export type ObsZonePresetId =
  | 'cylinder_fixed'
  | 'cylinder_symmetric'
  | 'start_line'
  | 'finish_line'
  | 'sector_to_next'
  | 'sector_fai'
  | 'custom';

export interface ObsZonePresetOption {
  id: ObsZonePresetId;
  label: string;
  description: string;
  forRoles?: CircuitLegRole[];
}

export const OBS_ZONE_PRESETS: ObsZonePresetOption[] = [
  {
    id: 'cylinder_fixed',
    label: 'Cylindre fixe',
    description: 'Style 0 — cylindre orienté au nord (SeeYou)',
    forRoles: ['turnpoint']
  },
  {
    id: 'cylinder_symmetric',
    label: 'Cylindre symétrique',
    description: 'Style 1 — orienté vers les points adjacents',
    forRoles: ['turnpoint']
  },
  {
    id: 'start_line',
    label: 'Ligne de départ',
    description: 'Style 2, Line=1 — cylindre coupé (décollage)',
    forRoles: ['departure']
  },
  {
    id: 'finish_line',
    label: 'Ligne d’arrivée',
    description: 'Style 3, Line=1 — vers le point précédent',
    forRoles: ['arrival']
  },
  {
    id: 'sector_to_next',
    label: 'Secteur vers suivant',
    description: 'Style 2 — secteur orienté vers le point suivant',
    forRoles: ['turnpoint', 'departure']
  },
  {
    id: 'sector_fai',
    label: 'Secteur FAI (large)',
    description: 'Style 0 — grand secteur avec R2 (compétition)',
    forRoles: ['turnpoint']
  },
  {
    id: 'custom',
    label: 'Personnalisé',
    description: 'Tous les paramètres CUP (Style, R1, A1, R2, A2, A12, Line)'
  }
];

export const CUP_STYLE_LABELS: Record<ObservationZoneConfig['cupStyle'], string> = {
  0: 'Fixe (0)',
  1: 'Symétrique (1)',
  2: 'Vers point suivant (2)',
  3: 'Vers point précédent (3)',
  4: 'Vers départ (4)'
};

export function defaultObservationZoneForRole(
  role: CircuitLegRole,
  defaultRadiusM: number
): ObservationZoneConfig {
  const r = Math.round(defaultRadiusM);
  switch (role) {
    case 'departure':
      return observationZoneFromPreset('start_line', r);
    case 'arrival':
      return observationZoneFromPreset('finish_line', r);
    default:
      return observationZoneFromPreset('cylinder_fixed', r);
  }
}

export function observationZoneFromPreset(
  presetId: ObsZonePresetId,
  defaultRadiusM = 400
): ObservationZoneConfig {
  const r = Math.round(defaultRadiusM);
  switch (presetId) {
    case 'cylinder_fixed':
      return { presetId, cupStyle: 0, r1M: r };
    case 'cylinder_symmetric':
      return { presetId, cupStyle: 1, r1M: r };
    case 'start_line':
      return { presetId, cupStyle: 2, r1M: r, a1Deg: 180, line: true };
    case 'finish_line':
      return { presetId, cupStyle: 3, r1M: r, a1Deg: 180, line: true };
    case 'sector_to_next':
      return { presetId, cupStyle: 2, r1M: r, a1Deg: 90 };
    case 'sector_fai':
      return {
        presetId,
        cupStyle: 0,
        r1M: 30000,
        a1Deg: 45,
        r2M: 12000,
        a2Deg: 12,
        a12Deg: 123.4
      };
    case 'custom':
      return { presetId, cupStyle: 0, r1M: r };
    default:
      return { presetId: 'cylinder_fixed', cupStyle: 0, r1M: r };
  }
}

export function normalizeObservationZone(
  zone: ObservationZoneConfig | undefined,
  role: CircuitLegRole,
  defaultRadiusM: number
): ObservationZoneConfig {
  if (!zone) {
    return defaultObservationZoneForRole(role, defaultRadiusM);
  }
  const r1 = Number.isFinite(zone.r1M) && zone.r1M > 0 ? Math.round(zone.r1M) : defaultRadiusM;
  const out: ObservationZoneConfig = {
    presetId: zone.presetId,
    cupStyle: zone.cupStyle ?? 0,
    r1M: r1,
    line: zone.line
  };
  if (zone.a1Deg != null && Number.isFinite(zone.a1Deg)) {
    out.a1Deg = Math.round(zone.a1Deg);
  }
  if (zone.r2M != null && zone.r2M > 0) {
    out.r2M = Math.round(zone.r2M);
  }
  if (zone.a2Deg != null && Number.isFinite(zone.a2Deg)) {
    out.a2Deg = Math.round(zone.a2Deg);
  }
  if (zone.a12Deg != null && Number.isFinite(zone.a12Deg)) {
    out.a12Deg = Math.round(zone.a12Deg);
  }
  return out;
}

/** Ligne `ObsZone=n,...` selon la spec Naviter CUP v1.2. */
export function formatCupObsZoneLine(index: number, zone: ObservationZoneConfig): string {
  const parts: string[] = [`ObsZone=${index}`, `Style=${zone.cupStyle}`, `R1=${zone.r1M}m`];
  if (zone.a1Deg != null && Number.isFinite(zone.a1Deg)) {
    parts.push(`A1=${zone.a1Deg}`);
  }
  if (zone.r2M != null && zone.r2M > 0) {
    parts.push(`R2=${zone.r2M}m`);
  }
  if (zone.a2Deg != null && Number.isFinite(zone.a2Deg)) {
    parts.push(`A2=${zone.a2Deg}`);
  }
  if (zone.a12Deg != null && Number.isFinite(zone.a12Deg)) {
    parts.push(`A12=${zone.a12Deg}`);
  }
  if (zone.line) {
    parts.push('Line=1');
  }
  return parts.join(',');
}

export function observationZoneShortLabel(zone: ObservationZoneConfig): string {
  if (zone.line) {
    return `Ligne ${zone.r1M} m`;
  }
  if (zone.r2M && zone.r2M > 1000) {
    return `Secteur ${(zone.r1M / 1000).toFixed(0)} km`;
  }
  if (zone.cupStyle === 1) {
    return `Cyl. sym. ${zone.r1M} m`;
  }
  return `Cyl. ${zone.r1M} m`;
}
