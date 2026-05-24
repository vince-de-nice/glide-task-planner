import type { BasemapId } from '../components/map-view/map-style.constants';

export type SafetyPrintLayoutMode = 'fullCircuit' | 'perBranch';

/** Coupe sur la même feuille que la carte, ou page dédiée. */
export type SafetyPrintProfilePlacement = 'withMap' | 'separatePage';

export interface SafetyPrintOptions {
  layoutMode: SafetyPrintLayoutMode;
  basemapId: BasemapId;
  coneVolumes3d: boolean;
  coneDistanceRings: boolean;
  safetyMinAltitudeRibbon: boolean;
  airspace3d: boolean;
  branchLines: boolean;
  waypoints: boolean;
  landableHighlights: boolean;
  map3dLabels: boolean;
  includeProfileChart: boolean;
  /** withMap : carte + coupe sur chaque feuille carte ; separatePage : coupe seule ensuite. */
  profileChartPlacement: SafetyPrintProfilePlacement;
  includeMetadata: boolean;
  /** Hauteur max de la coupe (% de la zone utile sous le bandeau). */
  profileChartHeightPercent: number;
}

export const SAFETY_PRINT_OPTIONS_STORAGE_KEY = 'gc-safety-print-options';

export const DEFAULT_SAFETY_PRINT_OPTIONS: SafetyPrintOptions = {
  layoutMode: 'fullCircuit',
  basemapId: 'esri-satellite',
  coneVolumes3d: false,
  coneDistanceRings: true,
  safetyMinAltitudeRibbon: true,
  airspace3d: true,
  branchLines: true,
  waypoints: true,
  landableHighlights: true,
  map3dLabels: true,
  includeProfileChart: true,
  profileChartPlacement: 'withMap',
  includeMetadata: true,
  profileChartHeightPercent: 30
};

export interface SafetyPrintMetadata {
  taskName: string;
  dateLabel: string;
  glideRatio: number;
  arrivalMarginM: number;
  groundMarginM: number;
  branchLabel?: string;
  pageLabel?: string;
}

export type SafetyPrintProgressPhase =
  | 'init'
  | 'map'
  | 'profile'
  | 'layout'
  | 'save';

export type SafetyPrintProfileSubPhase = 'prepare' | 'rasterize';

export interface SafetyPrintProgress {
  phase: SafetyPrintProgressPhase;
  /** Étape courante (1-based) dans le plan global. */
  step: number;
  stepTotal: number;
  /** Page PDF en cours (1-based). */
  pageIndex?: number;
  pageTotal?: number;
  /** Libellé lisible (branche, « carte N », etc.). */
  pageLabel?: string;
  /** Sous-étape de la coupe profil. */
  profileSubPhase?: SafetyPrintProfileSubPhase;
}
