import type { AirspaceScreenPrefs } from '../services/airspace-screen-prefs.service';

/** Représentation des espaces aériens sur la carte profil sécurité. */
export type AirspaceMapDisplayMode = 'off' | '2d' | '3d';

const CYCLE: Record<AirspaceMapDisplayMode, AirspaceMapDisplayMode> = {
  off: '2d',
  '2d': '3d',
  '3d': 'off'
};

export function cycleAirspaceDisplayMode(
  current: AirspaceMapDisplayMode
): AirspaceMapDisplayMode {
  return CYCLE[current];
}

export function airspaceModeFromPrefs(prefs: AirspaceScreenPrefs): AirspaceMapDisplayMode {
  if (!prefs.visible) return 'off';
  return prefs.volume3d ? '3d' : '2d';
}

export function applyAirspaceModeToPrefs(
  prefs: AirspaceScreenPrefs,
  mode: AirspaceMapDisplayMode
): AirspaceScreenPrefs {
  return {
    ...prefs,
    visible: mode !== 'off',
    volume3d: mode === '3d'
  };
}
