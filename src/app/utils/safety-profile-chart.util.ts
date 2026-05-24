import type { EnvelopeSample } from '../services/glide-envelope.service';
import {
  landableColorFromId,
  LANDABLE_GLIDE_CONE_FILL_OPACITY,
  SAFETY_PROFILE_SEMANTIC
} from './safety-profile-palette.util';

export {
  landableColorFromId,
  landableColorsForIds,
  landableMapLabelColorFromHex,
  landableMapLabelColorFromId,
  LANDABLE_GLIDE_CONE_FILL_OPACITY,
  LANDABLE_GLIDE_CONE_RING_OPACITY,
  LANDABLE_DISTINCT_HEX_PALETTE,
  SAFETY_PROFILE_SEMANTIC
} from './safety-profile-palette.util';

/** Plus haute altitude terrain (DEM) sur une coupe, en m MSL. */
export function maxTerrainElevationM(
  samples: Pick<EnvelopeSample, 'terrainM'>[]
): number {
  let max = 0;
  for (const s of samples) {
    if (s.terrainM != null && Number.isFinite(s.terrainM) && s.terrainM > max) {
      max = s.terrainM;
    }
  }
  return max;
}

/** Plus haute altitude mini (sécurité) sur la coupe, en m MSL. */
export function maxSafetyMinAltitudeM(
  samples: Pick<EnvelopeSample, 'safetyM'>[]
): number {
  let max = 0;
  for (const s of samples) {
    if (s.safetyM != null && Number.isFinite(s.safetyM) && s.safetyM > max) {
      max = s.safetyM;
    }
  }
  return max;
}

/** Arrondit une altitude au multiple de 500 m supérieur ou égal. */
export function ceilTo500M(altitudeM: number): number {
  const m = Math.round(altitudeM);
  if (!Number.isFinite(m) || m <= 0) return 500;
  let cap = 500;
  while (cap < m) cap += 500;
  return cap;
}

/**
 * Échelle verticale par défaut : plus haute altitude mini + 500 m,
 * arrondie au multiple de 500 m supérieur. Ex. max mini 2 140 m → 2 700 m.
 */
export function defaultLegYMaxM(
  samples: Pick<EnvelopeSample, 'safetyM'>[]
): number {
  const maxMini = maxSafetyMinAltitudeM(samples);
  if (maxMini <= 0) return 1000;
  return ceilTo500M(maxMini + 500);
}

/** Vert : altitude min suivant le cône (relief non contraignant). */
export const SAFETY_MIN_ALTITUDE_CONE_COLOR = SAFETY_PROFILE_SEMANTIC.safetyMinAltitudeCone;
/** Rouge : altitude min relevée par le relief. */
export const SAFETY_MIN_ALTITUDE_TERRAIN_COLOR =
  SAFETY_PROFILE_SEMANTIC.safetyMinAltitudeTerrain;
/** @deprecated Préférer SAFETY_MIN_ALTITUDE_CONE_COLOR / SAFETY_MIN_ALTITUDE_TERRAIN_COLOR. */
export const SAFETY_MIN_ALTITUDE_COLOR = SAFETY_MIN_ALTITUDE_TERRAIN_COLOR;

/** @deprecated Utiliser {@link landableColorFromId} par terrain. */
export const SAFETY_CONE_COLOR = SAFETY_MIN_ALTITUDE_COLOR;

/** @deprecated Utiliser {@link LANDABLE_GLIDE_CONE_FILL_OPACITY}. */
export const SAFETY_CONE_OPACITY = LANDABLE_GLIDE_CONE_FILL_OPACITY;

/** @deprecated Utiliser {@link landableColorFromId}. */
export function landableConeColorFromId(id: string): string {
  return landableColorFromId(id);
}
