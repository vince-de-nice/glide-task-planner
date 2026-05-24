/**
 * Style de l'altitude minimale combinée (safetyM) : vert = cône de plané,
 * rouge = plancher relevé par le relief (groundClearanceM > cône).
 */
import type { EnvelopeSample } from '../services/glide-envelope.service';
import { SAFETY_MIN_ALT_CROSSING_LABEL_OFFSET_M } from './safety-cone-crossings.util';
import type { SafetyMinAltitudeCrossingLabelSpec } from './safety-cone-crossings.util';
import {
  landableMapLabelColorFromHex,
  SAFETY_PROFILE_SEMANTIC
} from './safety-profile-palette.util';

/** Même seuil que la coupe cône / safety (belowMin). */
export const SAFETY_MIN_ALTITUDE_TERRAIN_EPS_M = 0.5;

export interface SafetyMinAltitudeStyledPoint {
  longitude: number;
  latitude: number;
  altitudeM: number;
  terrainConstrained: boolean;
}

export interface SafetyMinAltitudeChartSegment {
  path: string;
  terrainConstrained: boolean;
}

/** Section rouge : marge max entre le cône et l'enveloppe min portée par le relief. */
export interface SafetyMinAltitudeTerrainMarginSection {
  key: string;
  startDistanceKm: number;
  endDistanceKm: number;
  peakDistanceKm: number;
  longitude: number;
  latitude: number;
  peakSafetyM: number;
  maxMarginM: number;
  label: string;
}

/** Libellé carte / coupe, ex. « + 250 m ». */
export function formatSafetyTerrainMarginLabel(marginM: number): string {
  if (!Number.isFinite(marginM) || marginM <= 0) return '';
  return `+ ${Math.round(marginM).toLocaleString()} m`;
}

/** true lorsque safetyM est portée par le relief plutôt que par le cône. */
export function isSafetyMinAltitudeTerrainConstrained(s: EnvelopeSample): boolean {
  if (s.safetyM == null || !Number.isFinite(s.safetyM)) return false;
  const cone = s.glideConeM;
  const ground = s.groundClearanceM;
  if (cone == null || !Number.isFinite(cone)) {
    return ground != null && Number.isFinite(ground);
  }
  if (ground == null || !Number.isFinite(ground)) return false;
  return ground > cone + SAFETY_MIN_ALTITUDE_TERRAIN_EPS_M;
}

export function buildSafetyMinAltitudeStyledPath(
  samples: EnvelopeSample[]
): SafetyMinAltitudeStyledPoint[] {
  const out: SafetyMinAltitudeStyledPoint[] = [];
  let prev: EnvelopeSample | null = null;

  for (const s of samples) {
    if (s.safetyM == null || !Number.isFinite(s.safetyM)) {
      prev = null;
      continue;
    }

    if (prev?.safetyM != null && Number.isFinite(prev.safetyM)) {
      const prevTc = isSafetyMinAltitudeTerrainConstrained(prev);
      const tc = isSafetyMinAltitudeTerrainConstrained(s);
      if (prevTc !== tc) {
        const crossKm = crossingSafetyStyleKm(prev, s);
        if (crossKm != null) {
          out.push(styledPointFromSample(interpolateEnvelopeSample(prev, s, crossKm)));
        }
      }
    }

    out.push(styledPointFromSample(s));
    prev = s;
  }

  return out;
}

export function buildSafetyMinAltitudeChartSegments(
  samples: EnvelopeSample[],
  xKm: (km: number) => number,
  yM: (m: number) => number
): SafetyMinAltitudeChartSegment[] {
  const raw: SafetyPlotPoint[] = [];
  let prev: EnvelopeSample | null = null;

  for (const s of samples) {
    if (s.safetyM == null || !Number.isFinite(s.safetyM)) {
      prev = null;
      continue;
    }

    if (prev?.safetyM != null && Number.isFinite(prev.safetyM)) {
      const prevTc = isSafetyMinAltitudeTerrainConstrained(prev);
      const tc = isSafetyMinAltitudeTerrainConstrained(s);
      if (prevTc !== tc) {
        const crossKm = crossingSafetyStyleKm(prev, s);
        if (crossKm != null) {
          const mid = interpolateEnvelopeSample(prev, s, crossKm);
          raw.push(plotPointFromSample(mid, xKm, yM));
        }
      }
    }

    raw.push(plotPointFromSample(s, xKm, yM));
    prev = s;
  }

  return plotPointsToSegments(raw);
}

/** Sections rouges avec marge max cône → altitude min (pour libellés carte / coupe). */
export function buildSafetyMinAltitudeTerrainMarginSections(
  samples: EnvelopeSample[]
): SafetyMinAltitudeTerrainMarginSection[] {
  const sections: SafetyMinAltitudeTerrainMarginSection[] = [];
  let run: EnvelopeSample[] = [];

  const flush = (): void => {
    if (run.length === 0) return;
    const startKm = run[0].distanceKm;
    const endKm = run[run.length - 1].distanceKm;
    let maxMargin = -Infinity;
    let peak: EnvelopeSample | null = null;
    for (const s of run) {
      const margin = terrainConeMarginM(s);
      if (margin == null) continue;
      if (margin > maxMargin) {
        maxMargin = margin;
        peak = s;
      }
    }
    run = [];
    if (peak == null || !Number.isFinite(maxMargin) || maxMargin <= 0) return;

    sections.push({
      key: `terrain-margin-${sections.length}-${peak.distanceKm.toFixed(3)}`,
      startDistanceKm: startKm,
      endDistanceKm: endKm,
      peakDistanceKm: peak.distanceKm,
      longitude: peak.longitude,
      latitude: peak.latitude,
      peakSafetyM: peak.safetyM!,
      maxMarginM: maxMargin,
      label: formatSafetyTerrainMarginLabel(maxMargin)
    });
  };

  for (const s of samples) {
    if (isSafetyMinAltitudeTerrainConstrained(s) && s.safetyM != null) {
      run.push(s);
    } else {
      flush();
    }
  }
  flush();
  return sections;
}

/** Libellés 3D au-dessus des tronçons rouges sur la carte. */
export function buildSafetyMinAltitudeTerrainMarginMapLabelSpecs(
  sections: readonly SafetyMinAltitudeTerrainMarginSection[]
): SafetyMinAltitudeCrossingLabelSpec[] {
  const color = landableMapLabelColorFromHex(
    SAFETY_PROFILE_SEMANTIC.safetyMinAltitudeTerrain
  );
  return sections.map(sec => ({
    key: sec.key,
    longitude: sec.longitude,
    latitude: sec.latitude,
    altitudeM: sec.peakSafetyM + SAFETY_MIN_ALT_CROSSING_LABEL_OFFSET_M,
    label: sec.label,
    color
  }));
}

function terrainConeMarginM(s: EnvelopeSample): number | null {
  if (!isSafetyMinAltitudeTerrainConstrained(s)) return null;
  const cone = s.glideConeM;
  const safety = s.safetyM;
  if (
    cone == null ||
    safety == null ||
    !Number.isFinite(cone) ||
    !Number.isFinite(safety)
  ) {
    return null;
  }
  const margin = safety - cone;
  return margin > SAFETY_MIN_ALTITUDE_TERRAIN_EPS_M ? margin : null;
}

function styledPointFromSample(s: EnvelopeSample): SafetyMinAltitudeStyledPoint {
  return {
    longitude: s.longitude,
    latitude: s.latitude,
    altitudeM: s.safetyM!,
    terrainConstrained: isSafetyMinAltitudeTerrainConstrained(s)
  };
}

interface SafetyPlotPoint {
  x: number;
  y: number;
  terrainConstrained: boolean;
}

function plotPointFromSample(
  s: EnvelopeSample,
  xKm: (km: number) => number,
  yM: (m: number) => number
): SafetyPlotPoint {
  return {
    x: xKm(s.distanceKm),
    y: yM(s.safetyM!),
    terrainConstrained: isSafetyMinAltitudeTerrainConstrained(s)
  };
}

function plotPointsToSegments(points: SafetyPlotPoint[]): SafetyMinAltitudeChartSegment[] {
  if (points.length < 2) return [];

  const segments: SafetyMinAltitudeChartSegment[] = [];
  let run: SafetyPlotPoint[] = [points[0]];

  const flushRun = (): void => {
    if (run.length < 2) return;
    segments.push({
      path: `M ${run.map(p => `${p.x},${p.y}`).join(' L ')}`,
      terrainConstrained: run[0].terrainConstrained
    });
  };

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.terrainConstrained === run[0].terrainConstrained) {
      run.push(p);
    } else {
      flushRun();
      run = [run[run.length - 1], p];
    }
  }
  flushRun();
  return segments;
}

function crossingSafetyStyleKm(a: EnvelopeSample, b: EnvelopeSample): number | null {
  const ca = a.glideConeM;
  const cb = b.glideConeM;
  const ga = a.groundClearanceM;
  const gb = b.groundClearanceM;
  if (
    ca == null ||
    cb == null ||
    ga == null ||
    gb == null ||
    !Number.isFinite(ca) ||
    !Number.isFinite(cb) ||
    !Number.isFinite(ga) ||
    !Number.isFinite(gb)
  ) {
    return null;
  }
  const fa = ga - ca - SAFETY_MIN_ALTITUDE_TERRAIN_EPS_M;
  const fb = gb - cb - SAFETY_MIN_ALTITUDE_TERRAIN_EPS_M;
  if (fa * fb >= 0) return null;
  const t = fa / (fa - fb);
  if (t <= 0 || t >= 1) return null;
  return a.distanceKm + t * (b.distanceKm - a.distanceKm);
}

function interpolateEnvelopeSample(
  a: EnvelopeSample,
  b: EnvelopeSample,
  distanceKm: number
): EnvelopeSample {
  const span = b.distanceKm - a.distanceKm;
  const t = span === 0 ? 0 : (distanceKm - a.distanceKm) / span;
  const lerp = (x: number | null, y: number | null): number | null => {
    if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    return x + t * (y - x);
  };
  const glideConeM = lerp(a.glideConeM, b.glideConeM);
  const groundClearanceM = lerp(a.groundClearanceM, b.groundClearanceM);
  let safetyM = lerp(a.safetyM, b.safetyM);
  if (glideConeM != null && groundClearanceM != null) {
    safetyM = Math.max(glideConeM, groundClearanceM);
  }
  return {
    distanceKm,
    longitude: a.longitude + t * (b.longitude - a.longitude),
    latitude: a.latitude + t * (b.latitude - a.latitude),
    terrainM: lerp(a.terrainM, b.terrainM),
    terrainQuality: a.terrainQuality,
    groundClearanceM,
    glideConeM,
    safetyM,
    closestLandableId: a.closestLandableId,
    closestLandableDistanceKm: lerp(a.closestLandableDistanceKm, b.closestLandableDistanceKm)
  };
}
