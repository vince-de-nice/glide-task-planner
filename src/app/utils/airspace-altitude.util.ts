/** Conversion pieds → mètres. */
const FT_TO_M = 0.3048;

/** Pression standard ISA (niveau de vol). */
const FL_TO_M = 100 * FT_TO_M;

/** Plafond d'affichage pour limites « illimitées » (m MSL, ~FL660). */
export const AIRSPACE_UNLIMITED_CAP_M = 20_000;

export type AirspaceLimitKind = 'msl' | 'agl' | 'ground' | 'unlimited' | 'unknown';

export interface ParsedAirspaceLimit {
  kind: AirspaceLimitKind;
  /** MSL (m) pour msl ; décalage AGL (m) pour agl ; 0 pour ground. */
  valueM: number;
  /** Texte d'origine (affichage). */
  raw: string;
}

const FL_RE = /^FL\s*(\d+)\s*$/i;
const FT_AMSL_RE = /^(\d+)\s*FT\s*AMSL$/i;
const FT_AGL_RE = /^(\d+)\s*FT\s*AGL$/i;
const FT_RE = /^(\d+)\s*FT$/i;
const M_RE = /^(\d+)\s*M(?:\s*AMSL)?$/i;

const GROUND_TOKENS = new Set(['GND', 'SFC', 'SURFACE', 'GROUND', 'GRND']);
const UNLIMITED_TOKENS = new Set([
  'UNL',
  'UNLTD',
  'UNLIMITED',
  'UNLIMIT',
  'INF',
  'NO LIMIT'
]);

/** Niveau de vol → altitude MSL (pression standard 1013,25 hPa). */
export function flightLevelToMslM(fl: number): number {
  return fl * FL_TO_M;
}

export function isAglLimitText(text: string | undefined): boolean {
  return (text ?? '').toUpperCase().includes('AGL');
}

/**
 * Interprète une limite POAFF (texte + éventuellement mètres fournis).
 * Les pieds AMSL et les FL utilisent les règles demandées ; le texte brut est conservé.
 */
export function parseAirspaceLimit(
  text: string | undefined,
  metersHint?: number | null
): ParsedAirspaceLimit | null {
  const raw = text?.trim() ?? '';
  if (!raw) {
    if (metersHint != null && Number.isFinite(metersHint)) {
      return { kind: 'msl', valueM: metersHint, raw: `${Math.round(metersHint)} m` };
    }
    return null;
  }

  const upper = raw.toUpperCase();

  if (UNLIMITED_TOKENS.has(upper) || upper.includes('UNLIMITED')) {
    return { kind: 'unlimited', valueM: AIRSPACE_UNLIMITED_CAP_M, raw };
  }

  if (GROUND_TOKENS.has(upper)) {
    return { kind: 'ground', valueM: 0, raw };
  }

  const fl = upper.match(FL_RE);
  if (fl) {
    const n = Number(fl[1]);
    return { kind: 'msl', valueM: flightLevelToMslM(n), raw };
  }

  const ftAgl = upper.match(FT_AGL_RE);
  if (ftAgl) {
    return { kind: 'agl', valueM: Number(ftAgl[1]) * FT_TO_M, raw };
  }

  const ftAmsl = upper.match(FT_AMSL_RE) ?? upper.match(FT_RE);
  if (ftAmsl) {
    return { kind: 'msl', valueM: Number(ftAmsl[1]) * FT_TO_M, raw };
  }

  const mAmsl = upper.match(M_RE);
  if (mAmsl) {
    return { kind: 'msl', valueM: Number(mAmsl[1]), raw };
  }

  if (metersHint != null && Number.isFinite(metersHint)) {
    const kind: AirspaceLimitKind = isAglLimitText(raw) ? 'agl' : 'msl';
    return { kind, valueM: kind === 'agl' ? inferAglOffsetM(raw, metersHint) : metersHint, raw };
  }

  return { kind: 'unknown', valueM: 0, raw };
}

/** Déduit un décalage AGL (m) à partir du texte et de lowerM POAFF. */
function inferAglOffsetM(text: string, lowerM: number): number {
  const ft = text.toUpperCase().match(FT_AGL_RE) ?? text.toUpperCase().match(FT_RE);
  if (ft) return Number(ft[1]) * FT_TO_M;
  return Math.max(0, lowerM);
}

export interface ExtrusionBounds {
  extrusionBaseM: number;
  extrusionTopM: number;
  hasVolume: boolean;
  verticalLabel: string;
}

/**
 * Calcule les bornes MSL d'extrusion 3D.
 * @param groundM relief minimal sous le polygone (DEM), requis pour AGL / GND.
 */
export function resolveExtrusionBounds(
  lowerText: string | undefined,
  upperText: string | undefined,
  lowerM: number | undefined,
  upperM: number | undefined,
  groundM: number | null
): ExtrusionBounds | null {
  const lower = parseAirspaceLimit(lowerText, lowerM);
  const upper = parseAirspaceLimit(upperText, upperM);
  if (!lower && !upper) return null;

  let baseM: number | null = null;
  if (lower) {
    switch (lower.kind) {
      case 'agl':
        if (groundM != null) baseM = groundM + lower.valueM;
        break;
      case 'ground':
        if (groundM != null) baseM = groundM + lower.valueM;
        break;
      case 'msl':
        baseM = lower.valueM;
        break;
      case 'unlimited':
        baseM = 0;
        break;
      default:
        break;
    }
  }
  if (baseM == null && lowerM != null && Number.isFinite(lowerM) && !isAglLimitText(lowerText)) {
    baseM = lowerM;
  }
  if (
    baseM == null &&
    lower != null &&
    lowerM != null &&
    Number.isFinite(lowerM) &&
    groundM != null &&
    isAglLimitText(lowerText)
  ) {
    const offset = lower.kind === 'agl' ? lower.valueM : inferAglOffsetM(lowerText ?? '', lowerM);
    baseM = groundM + offset;
  }

  let topM: number | null = null;
  if (upper) {
    switch (upper.kind) {
      case 'agl':
        if (groundM != null) topM = groundM + upper.valueM;
        break;
      case 'ground':
        if (groundM != null) topM = groundM + upper.valueM;
        break;
      case 'msl':
        topM = upper.valueM;
        break;
      case 'unlimited':
        topM = AIRSPACE_UNLIMITED_CAP_M;
        break;
      default:
        break;
    }
  }
  if (topM == null && upperM != null && Number.isFinite(upperM)) {
    topM = upperM;
  }

  if (baseM == null || topM == null || !Number.isFinite(baseM) || !Number.isFinite(topM)) {
    return null;
  }

  if (topM <= baseM) return null;

  const verticalLabel = [lowerText, upperText].filter(Boolean).join(' → ');

  return {
    extrusionBaseM: baseM,
    extrusionTopM: topM,
    hasVolume: true,
    verticalLabel
  };
}
