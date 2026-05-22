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

/** Plus haute altitude affichée sur la coupe (relief, cônes, sécurité). */
export function maxProfileElevationM(
  samples: Pick<
    EnvelopeSample,
    'terrainM' | 'safetyM' | 'glideConeM' | 'groundClearanceM'
  >[]
): number {
  let max = 0;
  for (const s of samples) {
    for (const v of [s.terrainM, s.safetyM, s.glideConeM, s.groundClearanceM]) {
      if (v != null && Number.isFinite(v) && v > max) {
        max = v;
      }
    }
  }
  return max;
}

/**
 * Échelle verticale par défaut : millier supérieur au plus haut point de la coupe.
 * Ex. max 2 641 m → 3 000 m.
 */
export function defaultLegYMaxM(
  samples: Pick<
    EnvelopeSample,
    'terrainM' | 'safetyM' | 'glideConeM' | 'groundClearanceM'
  >[]
): number {
  const maxElev = maxProfileElevationM(samples);
  if (maxElev <= 0) return 1000;
  return Math.ceil(maxElev / 1000) * 1000;
}

/** Rouge réservé à la courbe d'altitude min combinée sur les coupes. */
export const SAFETY_MIN_ALTITUDE_COLOR = SAFETY_PROFILE_SEMANTIC.safetyMinAltitude;

/** @deprecated Utiliser {@link landableColorFromId} par terrain. */
export const SAFETY_CONE_COLOR = SAFETY_MIN_ALTITUDE_COLOR;

/** @deprecated Utiliser {@link LANDABLE_GLIDE_CONE_FILL_OPACITY}. */
export const SAFETY_CONE_OPACITY = LANDABLE_GLIDE_CONE_FILL_OPACITY;

/** @deprecated Utiliser {@link landableColorFromId}. */
export function landableConeColorFromId(id: string): string {
  return landableColorFromId(id);
}
