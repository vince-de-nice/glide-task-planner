import { Injectable } from '@angular/core';
import { DEFAULT_POAFF_REGION_ID } from '../config/map-airspace.config';
import {
  DEFAULT_AIRSPACE_ZONE_FILTERS,
  normalizeAirspaceZoneFilters,
  type AirspaceZoneFiltersPrefs
} from '../utils/airspace-zone-filter.util';

/** Écrans cartographiques de l'application. */
export type AirspaceScreenId = 'task-map' | 'safety-profile';

export interface AirspaceScreenPrefs {
  visible: boolean;
  volume3d: boolean;
  regionId: string;
  zoneFilters: AirspaceZoneFiltersPrefs;
}

const STORAGE_PREFIX = 'gc-airspace-prefs-';

const DEFAULT_PREFS: AirspaceScreenPrefs = {
  visible: false,
  volume3d: true,
  regionId: DEFAULT_POAFF_REGION_ID,
  zoneFilters: DEFAULT_AIRSPACE_ZONE_FILTERS
};

@Injectable({ providedIn: 'root' })
export class AirspaceScreenPrefsService {
  get(screenId: AirspaceScreenId): AirspaceScreenPrefs {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + screenId);
      if (!raw) return { ...DEFAULT_PREFS };
      const parsed = JSON.parse(raw) as Partial<AirspaceScreenPrefs>;
      return {
        visible: parsed.visible === true,
        volume3d: parsed.volume3d !== false,
        regionId:
          typeof parsed.regionId === 'string' && parsed.regionId.length > 0
            ? parsed.regionId
            : DEFAULT_POAFF_REGION_ID,
        zoneFilters: normalizeAirspaceZoneFilters(parsed.zoneFilters)
      };
    } catch {
      return { ...DEFAULT_PREFS };
    }
  }

  save(screenId: AirspaceScreenId, prefs: AirspaceScreenPrefs): void {
    localStorage.setItem(STORAGE_PREFIX + screenId, JSON.stringify(prefs));
  }

  patch(
    screenId: AirspaceScreenId,
    patch: Partial<AirspaceScreenPrefs>
  ): AirspaceScreenPrefs {
    const next = { ...this.get(screenId), ...patch };
    this.save(screenId, next);
    return next;
  }
}
