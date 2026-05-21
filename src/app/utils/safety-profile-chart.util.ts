import type { EnvelopeSample } from '../services/glide-envelope.service';

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

/**
 * Échelle verticale par défaut : millier supérieur au plus haut relief de la coupe.
 * Ex. relief max 2 450 m → 3 000 m ; 3 000 m → 3 000 m.
 */
export function defaultLegYMaxM(
  samples: Pick<EnvelopeSample, 'terrainM'>[]
): number {
  const maxTerrain = maxTerrainElevationM(samples);
  if (maxTerrain <= 0) return 1000;
  return Math.ceil(maxTerrain / 1000) * 1000;
}

/** Rouge réservé à la courbe d'altitude min combinée sur les coupes. */
export const SAFETY_MIN_ALTITUDE_COLOR = '#dc2626';

/** Angle d'or (°) pour espacer les teintes le plus possible. */
const GOLDEN_ANGLE_DEG = 137.508;

/** Teintes exclues (proche du rouge altitude min). */
const RED_HUE_EXCLUDE_MIN = 350;
const RED_HUE_EXCLUDE_MAX = 28;

/**
 * Couleur stable par terrain posable — grande variété via HSL + angle d'or,
 * sans teinte rouge (réservée à l'altitude min).
 */
export function landableColorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }

  let hue = (hash * GOLDEN_ANGLE_DEG) % 360;
  if (hue >= RED_HUE_EXCLUDE_MIN || hue <= RED_HUE_EXCLUDE_MAX) {
    hue = 30 + ((hue + 40) % 300);
  }

  const sat = 62 + (hash % 6) * 5;
  const light = 36 + ((hash >> 3) % 14);
  return `hsl(${hue.toFixed(1)} ${sat}% ${light}%)`;
}
