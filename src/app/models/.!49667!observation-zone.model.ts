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
  /** Angle A12 (°) — cap de référence en Style 0 ; axe du secteur ≈ A12 + 180° (SeeYou/XCSoar) */
  a12Deg?: number;
  /** Ligne de départ / arrivée (CUP `Line=1`) */
  line?: boolean;
}

export type ObsZonePresetId =
  | 'cylinder_fixed'
  | 'cylinder_symmetric'
  | 'start_line'
  | 'finish_line'
  | 'departure_cylinder'
  | 'arrival_cylinder'
  | 'arrival_ring'
  | 'start_cylinder_fai'
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
