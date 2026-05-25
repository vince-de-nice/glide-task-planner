import type { BasemapId } from '../components/map-view/map-style.constants';

export type SafetyPrintLayoutMode = 'fullCircuit' | 'perBranch';

/**
 * Disposition des coupes profil (mode « une page par branche »).
 * - withMap : carte + coupe sur chaque feuille carte
 * - separatePage : une page paysage par branche
 * - allOnOnePage : toutes les coupes empilées sur une seule page paysage
 */
export type SafetyPrintProfilePlacement = 'withMap' | 'separatePage' | 'allOnOnePage';

export interface SafetyPrintOptions {
  layoutMode: SafetyPrintLayoutMode;
  basemapId: BasemapId;
  coneVolumes3d: boolean;
  coneDistanceRings: boolean;
  safetyMinAltitudeRibbon: boolean;
  /** Polygones 2D des zones actives (pas de fil de fer 3D). */
  airspace2d: boolean;
  branchLines: boolean;
  waypoints: boolean;
  landableHighlights: boolean;
  map3dLabels: boolean;
  includeProfileChart: boolean;
  /** withMap : carte + coupe sur chaque feuille carte ; separatePage : coupe seule ensuite. */
  profileChartPlacement: SafetyPrintProfilePlacement;
  includeMetadata: boolean;
  /** Récapitulatif textuel des zones actives par tronçon (aller/retour regroupés). */
  includeAirspaceZonesSummary: boolean;
  /** Hauteur max de la coupe (% de la zone utile sous le bandeau). */
  profileChartHeightPercent: number;
}

export const SAFETY_PRINT_OPTIONS_STORAGE_KEY = 'gc-safety-print-options';

export const DEFAULT_SAFETY_PRINT_OPTIONS: SafetyPrintOptions = {
  layoutMode: 'fullCircuit',
  /** Fond topo sobre (pas de satellite / relief DEM à l’impression). */
  basemapId: 'carto-light',
  coneVolumes3d: false,
  coneDistanceRings: true,
  safetyMinAltitudeRibbon: true,
  airspace2d: true,
  branchLines: true,
  waypoints: true,
  landableHighlights: true,
  map3dLabels: true,
  includeProfileChart: true,
  profileChartPlacement: 'withMap',
  includeMetadata: true,
  includeAirspaceZonesSummary: true,
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

export type SafetyPrintProfileSubPhase = 'prepare' | 'vectorize';

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
