import type {
  EnvelopeSample,
  LandableConeSample,
  LandableConeVisual
} from '../services/glide-envelope.service';
import { formatMetersDisplay } from './airspace-altitude.util';
import { findCurvePairCrossings } from './landable-cone-intersection.util';
import { landableMapLabelColorFromHex } from './safety-profile-palette.util';

const DEDUPE_ALONG_KM = 0.06;
/** Tolérance (m) pour considérer un croisement cône×cône sur l’enveloppe min. */
const ON_SAFETY_LINE_TOLERANCE_M = 8;

/** Décalage MSL au-dessus du ruban 3D pour les libellés carte. */
export const SAFETY_MIN_ALT_CROSSING_LABEL_OFFSET_M = 60;

export interface SafetyMinAltitudeCrossingLabelSpec {
  key: string;
  longitude: number;
  latitude: number;
  altitudeM: number;
  label: string;
  color: string;
}

export interface SafetyCrossingLabelScreenPosition {
  key: string;
  x: number;
  y: number;
  label: string;
  color: string;
}

export interface SafetyConeCrossingHit {
  key: string;
  distanceKm: number;
  altitudeM: number;
  longitude: number;
  latitude: number;
  color: string;
}

/** Interpolation linéaire le long de la coupe (distance, position, safetyM). */
export function interpolateEnvelopeAt(
  samples: EnvelopeSample[],
  alongKm: number
): {
  longitude: number;
  latitude: number;
  safetyM: number | null;
} | null {
  if (samples.length === 0) return null;
  if (samples.length === 1) {
    const s = samples[0];
    return { longitude: s.longitude, latitude: s.latitude, safetyM: s.safetyM };
  }

  const first = samples[0];
  const last = samples[samples.length - 1];
  if (alongKm <= first.distanceKm) {
    return {
      longitude: first.longitude,
      latitude: first.latitude,
      safetyM: first.safetyM
    };
  }
  if (alongKm >= last.distanceKm) {
    return {
      longitude: last.longitude,
      latitude: last.latitude,
      safetyM: last.safetyM
    };
  }

  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i];
    const b = samples[i + 1];
    if (alongKm < a.distanceKm || alongKm > b.distanceKm) continue;
    const span = b.distanceKm - a.distanceKm;
    const t = span > 0 ? (alongKm - a.distanceKm) / span : 0;
    return {
      longitude: a.longitude + t * (b.longitude - a.longitude),
      latitude: a.latitude + t * (b.latitude - a.latitude),
      safetyM:
        a.safetyM != null && b.safetyM != null
          ? a.safetyM + t * (b.safetyM - a.safetyM)
          : (a.safetyM ?? b.safetyM)
    };
  }
  return null;
}

export function interpolateSafetyM(
  samples: EnvelopeSample[],
  alongKm: number
): number | null {
  return interpolateEnvelopeAt(samples, alongKm)?.safetyM ?? null;
}

function findCurveSafetyCrossings(
  curve: LandableConeSample[],
  samples: EnvelopeSample[]
): Array<{ distanceKm: number; altitudeM: number }> {
  const hits: Array<{ distanceKm: number; altitudeM: number }> = [];
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1];
    const b = curve[i];
    const lineA = interpolateSafetyM(samples, a.distanceKm);
    const lineB = interpolateSafetyM(samples, b.distanceKm);
    if (lineA == null || lineB == null) continue;
    const fa = a.altitudeM - lineA;
    const fb = b.altitudeM - lineB;
    if (fa * fb >= 0) continue;
    const t = fa / (fa - fb);
    const distanceKm = a.distanceKm + t * (b.distanceKm - a.distanceKm);
    const lineAlt =
      interpolateSafetyM(samples, distanceKm) ?? lineA + t * (lineB - lineA);
    hits.push({ distanceKm, altitudeM: lineAlt });
  }
  return hits;
}

function hitToMapPoint(
  hit: { distanceKm: number; altitudeM: number },
  samples: EnvelopeSample[],
  key: string,
  color: string
): SafetyConeCrossingHit | null {
  const pos = interpolateEnvelopeAt(samples, hit.distanceKm);
  if (!pos || pos.safetyM == null) return null;
  return {
    key,
    distanceKm: hit.distanceKm,
    altitudeM: pos.safetyM,
    longitude: pos.longitude,
    latitude: pos.latitude,
    color
  };
}

function isOnSafetyLine(
  samples: EnvelopeSample[],
  distanceKm: number,
  altitudeM: number
): boolean {
  const safetyM = interpolateSafetyM(samples, distanceKm);
  return (
    safetyM != null && Math.abs(safetyM - altitudeM) <= ON_SAFETY_LINE_TOLERANCE_M
  );
}

function dedupeCrossingHits(hits: SafetyConeCrossingHit[]): SafetyConeCrossingHit[] {
  const sorted = [...hits].sort((a, b) => a.distanceKm - b.distanceKm);
  const kept: SafetyConeCrossingHit[] = [];
  for (const hit of sorted) {
    if (
      kept.some(k => Math.abs(k.distanceKm - hit.distanceKm) < DEDUPE_ALONG_KM)
    ) {
      continue;
    }
    kept.push(hit);
  }
  return kept;
}

/**
 * Croisements sur la ligne d’altitude min. : cône × safetyM et cône × cône
 * lorsque le point est sur l’enveloppe (safetyM).
 */
export function collectActiveConeCrossings(
  cones: readonly LandableConeVisual[],
  samples: EnvelopeSample[],
  colorForId: (id: string) => string
): SafetyConeCrossingHit[] {
  if (cones.length === 0 || samples.length === 0) return [];

  const raw: SafetyConeCrossingHit[] = [];

  for (const cone of cones) {
    const color = colorForId(cone.id);
    for (const [i, hit] of findCurveSafetyCrossings(cone.curve, samples).entries()) {
      const pt = hitToMapPoint(hit, samples, `safety-${cone.id}-${i}`, color);
      if (pt) raw.push(pt);
    }
  }

  for (let a = 0; a < cones.length; a++) {
    for (let b = a + 1; b < cones.length; b++) {
      const hits = findCurvePairCrossings(cones[a].curve, cones[b].curve);
      for (let i = 0; i < hits.length; i++) {
        const hit = hits[i];
        if (!isOnSafetyLine(samples, hit.distanceKm, hit.altitudeM)) continue;
        const pt = hitToMapPoint(
          hit,
          samples,
          `pair-${cones[a].id}-${cones[b].id}-${i}`,
          colorForId(cones[a].id)
        );
        if (pt) raw.push(pt);
      }
    }
  }

  return dedupeCrossingHits(raw);
}

/** Libellés 3D sur la ligne d’altitude min. (même croisements que la coupe). */
export function buildSafetyMinAltitudeCrossingLabelSpecs(
  hits: readonly SafetyConeCrossingHit[],
  samples: EnvelopeSample[]
): SafetyMinAltitudeCrossingLabelSpec[] {
  const specs: SafetyMinAltitudeCrossingLabelSpec[] = [];
  for (const hit of hits) {
    const safetyM = interpolateSafetyM(samples, hit.distanceKm);
    if (safetyM == null) continue;
    specs.push({
      key: hit.key,
      longitude: hit.longitude,
      latitude: hit.latitude,
      altitudeM: safetyM + SAFETY_MIN_ALT_CROSSING_LABEL_OFFSET_M,
      label: formatMetersDisplay(Math.round(safetyM)),
      color: landableMapLabelColorFromHex(hit.color)
    });
  }
  return specs;
}
