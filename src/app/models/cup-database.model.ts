import { Waypoint } from './waypoint.model';

export interface CupDatabaseState {
  sourceUrl: string | null;
  sourceLabel: string;
  loadedAt: string;
  cupHeaderLine: string;
  waypoints: Waypoint[];
}

export interface CupApplyMeta {
  sourceUrl: string | null;
  sourceLabel: string;
}
