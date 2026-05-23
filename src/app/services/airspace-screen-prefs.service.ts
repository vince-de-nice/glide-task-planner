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
  zoneFilters: AirspaceZoneFiltersPrefs;
}

const STORAGE_PREFIX = 'gc-airspace-prefs-';

const DEFAULT_PREFS_BY_SCREEN: Record<AirspaceScreenId, AirspaceScreenPrefs> = {
  'task-map': {
    visible: false,
    volume3d: true,
    zoneFilters: DEFAULT_AIRSPACE_ZONE_FILTERS
  },
  /** Affichage piloté par les zones activées sur la branche (pas de toggle global). */
  'safety-profile': {
    visible: true,
    volume3d: true,
    zoneFilters: DEFAULT_AIRSPACE_ZONE_FILTERS
  }
};

@Injectable({ providedIn: 'root' })
export class AirspaceScreenPrefsService {
  get(screenId: AirspaceScreenId): AirspaceScreenPrefs {
    const defaults = { ...DEFAULT_PREFS_BY_SCREEN[screenId] };
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + screenId);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as Partial<AirspaceScreenPrefs>;
      return {
        visible:
          screenId === 'safety-profile'
            ? parsed.visible !== false
            : parsed.visible === true,
        volume3d: parsed.volume3d !== false,
        zoneFilters: normalizeAirspaceZoneFilters(parsed.zoneFilters)
      };
    } catch {
      return defaults;
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
