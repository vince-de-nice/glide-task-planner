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
/** FL dans un libellé composé (ex. « SFC → FL999 »). */
const FL_EMBEDDED_RE = /\bFL\s*(\d+)\b/i;
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

/** FL « illimité » courant en POAFF / OpenAir (≈ 30,5 km MSL, pression standard). */
export const FL999_CEILING_M = flightLevelToMslM(999);

/** Extrait un niveau de vol du texte POAFF (tolère libellés composés). */
export function extractFlightLevelFromText(text: string | undefined): number | null {
  const raw = text?.trim() ?? '';
  if (!raw) return null;
  const embedded = raw.toUpperCase().match(FL_EMBEDDED_RE);
  if (embedded) return Number(embedded[1]);
  const strict = raw.toUpperCase().match(FL_RE);
  if (strict) return Number(strict[1]);
  return null;
}

/**
 * Plafond MSL : priorité au texte FL (ICAO), puis upperM POAFF (mètres).
 * Évite d’interpréter upperM=999 comme 999 m quand le libellé est FL999.
 */
export function resolveCeilingMslM(
  upperText: string | undefined,
  upperM: number | undefined
): number | null {
  const fl = extractFlightLevelFromText(upperText);
  if (fl != null) {
    const fromFl = flightLevelToMslM(fl);
    if (
      upperM != null &&
      Number.isFinite(upperM) &&
      upperM >= fromFl * 0.85
    ) {
      return upperM;
    }
    return fromFl;
  }

  const parsed = parseAirspaceLimit(upperText, undefined);
  if (parsed?.kind === 'msl') return parsed.valueM;
  if (parsed?.kind === 'unlimited') return AIRSPACE_UNLIMITED_CAP_M;
  if (upperM != null && Number.isFinite(upperM)) return upperM;
  return null;
}

/**
 * Plancher MSL / terrain : texte GND/SFC/AGL prioritaire ; lowerM POAFF en secours MSL.
 */
export function resolveFloorReferenceM(
  lowerText: string | undefined,
  lowerM: number | undefined,
  groundM: number | null
): number | null {
  const parsed = parseAirspaceLimit(lowerText, undefined);
  if (!parsed) {
    if (lowerM != null && Number.isFinite(lowerM) && !isAglLimitText(lowerText)) {
      return lowerM;
    }
    return null;
  }

  switch (parsed.kind) {
    case 'agl':
    case 'ground':
      if (groundM != null) return groundM + parsed.valueM;
      return null;
    case 'msl':
      return parsed.valueM;
    case 'unlimited':
      return 0;
    default:
      return null;
  }
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

  const flEmbedded = upper.match(FL_EMBEDDED_RE);
  if (flEmbedded) {
    const n = Number(flEmbedded[1]);
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
  const lower = parseAirspaceLimit(lowerText, undefined);
  const upper = parseAirspaceLimit(upperText, undefined);
  if (!lower && !upper && upperM == null && lowerM == null) return null;

  let baseM = resolveFloorReferenceM(lowerText, lowerM, groundM);
  if (baseM == null && lower) {
    switch (lower.kind) {
      case 'agl':
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
  if (
    baseM == null &&
    lowerM != null &&
    Number.isFinite(lowerM) &&
    !isAglLimitText(lowerText) &&
    !GROUND_TOKENS.has((lowerText ?? '').trim().toUpperCase())
  ) {
    baseM = lowerM;
  }

  let topM = resolveCeilingMslM(upperText, upperM);
  if (topM == null && upper) {
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
