import type { BasemapId } from '../components/map-view/map-style.constants';

export type SafetyPrintLayoutMode = 'fullCircuit' | 'perBranch';

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
  includeMetadata: boolean;
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
  includeMetadata: true
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

export interface SafetyPrintProgress {
  phase: string;
  current: number;
  total: number;
}
