import { describe, expect, it } from 'vitest';
import {
  airspaceModeFromPrefs,
  applyAirspaceModeToPrefs,
  cycleAirspaceDisplayMode
} from './airspace-display-mode.util';
import { DEFAULT_AIRSPACE_ZONE_FILTERS } from './airspace-zone-filter.util';

const basePrefs = {
  visible: true,
  volume3d: true,
  zoneFilters: DEFAULT_AIRSPACE_ZONE_FILTERS
};

describe('airspace display mode', () => {
  it('cycles off → 2d → 3d → off', () => {
    expect(cycleAirspaceDisplayMode('off')).toBe('2d');
    expect(cycleAirspaceDisplayMode('2d')).toBe('3d');
    expect(cycleAirspaceDisplayMode('3d')).toBe('off');
  });

  it('maps prefs to mode and back', () => {
    expect(airspaceModeFromPrefs({ ...basePrefs, visible: false })).toBe('off');
    expect(airspaceModeFromPrefs({ ...basePrefs, volume3d: false })).toBe('2d');
    expect(airspaceModeFromPrefs(basePrefs)).toBe('3d');
    expect(applyAirspaceModeToPrefs(basePrefs, '2d').volume3d).toBe(false);
    expect(applyAirspaceModeToPrefs(basePrefs, 'off').visible).toBe(false);
  });
});
