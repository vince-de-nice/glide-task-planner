/**
 * Palette profil de sécurité : couleurs hex distinctes par terrain posable,
 * partagées entre carte, cônes 3D (Three.js), anneaux, libellés et coupe.
 *
 * Seuls les éléments globaux utilisent {@link SAFETY_PROFILE_SEMANTIC}.
 */

/** Opacités du volume / anneaux (teinte = couleur du terrain en hex). */
export const LANDABLE_GLIDE_CONE_FILL_OPACITY = 0.32;
export const LANDABLE_GLIDE_CONE_RING_OPACITY = 0.9;

/** Éléments globaux (pas liés à un terrain X vs Y). */
export const SAFETY_PROFILE_SEMANTIC = {
  /** Altitude min combinée suivant le cône (relief non contraignant). */
  safetyMinAltitudeCone: '#16a34a',
  /** Altitude min relevée par le relief au-dessus du cône. */
  safetyMinAltitudeTerrain: '#dc2626',
  /** @deprecated Préférer safetyMinAltitudeCone / safetyMinAltitudeTerrain. */
  safetyMinAltitude: '#dc2626',
  legEndpoint: '#2563eb',
  legRouteActive: '#f97316',
  legRouteInactive: '#fbbf24',
  profileCrosshair: '#db2777'
} as const;

/**
 * Teintes saturées, contrastées (Paul Tol / Kelly), sans rouge enveloppe min.
 * Compatible Three.js, MapLibre et SVG (hex uniquement).
 */
export const LANDABLE_DISTINCT_HEX_PALETTE: readonly string[] = [
  '#4477AA',
  '#EE7733',
  '#228833',
  '#CCBB44',
  '#66CCEE',
  '#AA3377',
  '#332288',
  '#44AA99',
  '#999933',
  '#882255',
  '#661100',
  '#6699CC',
  '#117733',
  '#88CCEE',
  '#DDCC77',
  '#AA4499',
  '#009988',
  '#EE3377',
  '#0077BB',
  '#33BBEE',
  '#7986CB',
  '#26A69A',
  '#AB47BC',
  '#5C6BC0',
  '#00838F',
  '#6A1B9A',
  '#EF6C00',
  '#2E7D32',
  '#AD1457',
  '#1565C0',
  '#558B2F',
  '#00897B',
  '#4527A0',
  '#E65100',
  '#283593',
  '#827717',
  '#00695C',
  '#BF360C',
  '#37474F',
  '#6D4C41',
  '#4E342E',
  '#7B1FA2',
  '#C2185B',
  '#0097A7',
  '#F57F17',
  '#689F38',
  '#5D4037',
  '#303F9F',
  '#FF8F00'
] as const;

const PALETTE_LEN = LANDABLE_DISTINCT_HEX_PALETTE.length;

function stableHash(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${clamp(r)}${clamp(g)}${clamp(b)}`;
}

/** Assombrit une couleur hex (facteur 0–1 sur chaque canal). */
export function darkenHex(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * factor, g * factor, b * factor);
}

function paletteHueDeg(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  if (max === min) return 0;
  const d = max - min;
  let h = 0;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return ((h * 60) % 360 + 360) % 360;
}

function hueDistanceDeg(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 360 - d);
}

/**
 * Indices de palette triés par teinte (répartition régulière le long du cercle chromatique).
 */
const PALETTE_BY_HUE: readonly number[] = (() => {
  const idx = LANDABLE_DISTINCT_HEX_PALETTE.map((_, i) => i);
  idx.sort(
    (a, b) =>
      paletteHueDeg(LANDABLE_DISTINCT_HEX_PALETTE[a]) -
      paletteHueDeg(LANDABLE_DISTINCT_HEX_PALETTE[b])
  );
  return idx;
})();

/**
 * Couleurs très contrastées pour les terrains affichés ensemble sur une branche :
 * répartition uniforme sur la palette triée par teinte (N ≤ 48 → pas de collision).
 */
export function landableColorsForIds(
  ids: readonly string[]
): ReadonlyMap<string, string> {
  const unique = [...new Set(ids)].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
  const out = new Map<string, string>();
  const n = unique.length;
  if (n === 0) return out;
  if (n === 1) {
    out.set(unique[0], landableColorFromId(unique[0]));
    return out;
  }

  if (n <= PALETTE_LEN) {
    const step = PALETTE_LEN / n;
    for (let i = 0; i < n; i++) {
      const paletteIdx =
        PALETTE_BY_HUE[Math.floor(i * step) % PALETTE_LEN] ?? 0;
      out.set(unique[i], LANDABLE_DISTINCT_HEX_PALETTE[paletteIdx]);
    }
    return out;
  }

  const paletteHues = LANDABLE_DISTINCT_HEX_PALETTE.map(paletteHueDeg);
  const used = new Set<number>();
  for (const id of unique) {
    let bestIdx = stableHash(id) % PALETTE_LEN;
    let bestScore = -1;
    for (let p = 0; p < PALETTE_LEN; p++) {
      if (used.has(p)) continue;
      let score = 360;
      for (const u of used) {
        score = Math.min(score, hueDistanceDeg(paletteHues[p], paletteHues[u]));
      }
      if (score > bestScore) {
        bestScore = score;
        bestIdx = p;
      }
    }
    used.add(bestIdx);
    out.set(id, LANDABLE_DISTINCT_HEX_PALETTE[bestIdx]);
  }
  return out;
}

/** Couleur stable hors contexte branche (hash → palette). */
export function landableColorFromId(id: string): string {
  return LANDABLE_DISTINCT_HEX_PALETTE[stableHash(id) % PALETTE_LEN];
}

/** Libellés carte (anneaux) : même teinte, plus foncée. */
export function landableMapLabelColorFromId(id: string): string {
  return darkenHex(landableColorFromId(id), 0.72);
}

/** Variante label à partir d'une couleur déjà assignée sur la branche. */
export function landableMapLabelColorFromHex(hex: string): string {
  return darkenHex(hex, 0.72);
}
