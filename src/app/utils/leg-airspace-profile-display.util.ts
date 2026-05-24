import type { FeatureCollection, Geometry } from 'geojson';
import type { EnvelopeSample } from '../services/glide-envelope.service';
import type { AirspaceVolumeProperties } from './airspace-volume-enrich.util';
import {
  computeLegAirspaceProfileBands,
  type LegAirspaceProfileBand,
  type LegAirspaceProfileBandRaw,
  type LegAirspaceProfileLeg
} from './leg-airspace-profile-cross-section.util';

export type { LegAirspaceProfileBand, LegAirspaceProfileBandRaw };

/**
 * Marge par défaut au-dessus de l'altitude mini (MSL) pour borner l'affichage
 * des espaces aériens sur la coupe profil.
 *
 * Les planeurs de circuit ne volent pas au plafond réglementaire des grandes zones
 * (TMA, CTR haute, etc.) : on trace uniquement la tranche utile au-dessus du mini.
 */
export const DEFAULT_AIRSPACE_PROFILE_MARGIN_M = 400;

const KM_EPS = 1e-4;
const ALT_EPS_M = 1;

/**
 * Calcule les bandes d'espace aérien prêtes pour la coupe (intersection + enveloppe de vol).
 */
export function computeLegAirspaceProfileBandsForChart(
  leg: LegAirspaceProfileLeg,
  collection: FeatureCollection<Geometry, AirspaceVolumeProperties>,
  enabledKeys: ReadonlySet<string>,
  samples: Pick<EnvelopeSample, 'distanceKm' | 'safetyM'>[],
  marginAboveSafetyM: number
): LegAirspaceProfileBand[] {
  const raw = computeLegAirspaceProfileBands(leg, collection, enabledKeys);
  return applyAirspaceProfileDisplayLimits(raw, samples, marginAboveSafetyM);
}

/**
 * Applique l'enveloppe de vol pertinente aux bandes d'espace aérien :
 * - `displayCeilingM` = min(plafond zone, max(safetyM + marge) sur l'intervalle km)
 * - masque les zones entièrement au-dessus de cette enveloppe
 * - signale `ceilingTruncated` lorsque le plafond réglementaire dépasse l'affichage
 */
export function applyAirspaceProfileDisplayLimits(
  bands: LegAirspaceProfileBandRaw[],
  samples: Pick<EnvelopeSample, 'distanceKm' | 'safetyM'>[],
  marginAboveSafetyM: number
): LegAirspaceProfileBand[] {
  const marginM = Math.max(0, marginAboveSafetyM);
  const out: LegAirspaceProfileBand[] = [];

  for (const band of bands) {
    const regulatoryFloor = Math.min(band.floorM, band.ceilingM);
    const regulatoryCeiling = Math.max(band.floorM, band.ceilingM);
    const relevantTop = maxRelevantTopOnKmInterval(
      samples,
      band.alongStartKm,
      band.alongEndKm,
      marginM
    );

    if (regulatoryFloor > relevantTop + ALT_EPS_M) {
      continue;
    }

    const displayCeiling = Math.min(regulatoryCeiling, relevantTop);
    const displayFloor = regulatoryFloor;
    if (displayCeiling - displayFloor < ALT_EPS_M) {
      continue;
    }

    const ceilingTruncated = regulatoryCeiling > displayCeiling + ALT_EPS_M;

    out.push({
      ...band,
      floorM: regulatoryFloor,
      ceilingM: regulatoryCeiling,
      displayFloorM: displayFloor,
      displayCeilingM: displayCeiling,
      ceilingTruncated
    });
  }

  return out;
}

/**
 * Enveloppe haute pertinente à une abscisse (km) : altitude mini + marge.
 * Interpole `safetyM` le long des échantillons du profil.
 */
export function relevantTopAtKm(
  samples: Pick<EnvelopeSample, 'distanceKm' | 'safetyM'>[],
  km: number,
  marginAboveSafetyM: number
): number {
  const safety = safetyMinAtKm(samples, km);
  if (safety == null) return marginAboveSafetyM;
  return safety + marginAboveSafetyM;
}

/**
 * Maximum de l'enveloppe pertinente sur un intervalle le long de la branche.
 * Évalue chaque échantillon dans l'intervalle ainsi que les bornes (interpolation).
 */
export function maxRelevantTopOnKmInterval(
  samples: Pick<EnvelopeSample, 'distanceKm' | 'safetyM'>[],
  startKm: number,
  endKm: number,
  marginAboveSafetyM: number
): number {
  const a = Math.min(startKm, endKm);
  const b = Math.max(startKm, endKm);
  let maxTop = 0;

  const push = (km: number): void => {
    maxTop = Math.max(maxTop, relevantTopAtKm(samples, km, marginAboveSafetyM));
  };

  push(a);
  push(b);

  for (const s of samples) {
    if (s.distanceKm < a - KM_EPS || s.distanceKm > b + KM_EPS) continue;
    if (s.safetyM != null && Number.isFinite(s.safetyM)) {
      maxTop = Math.max(maxTop, s.safetyM + marginAboveSafetyM);
    }
  }

  return maxTop;
}

/** Altitude mini interpolée (m MSL) à `km`, ou null si aucune donnée. */
export function safetyMinAtKm(
  samples: Pick<EnvelopeSample, 'distanceKm' | 'safetyM'>[],
  km: number
): number | null {
  if (samples.length === 0) return null;

  const sorted = [...samples].sort((x, y) => x.distanceKm - y.distanceKm);
  if (km <= sorted[0].distanceKm) {
    return finiteSafety(sorted[0].safetyM);
  }
  const last = sorted[sorted.length - 1];
  if (km >= last.distanceKm) {
    return finiteSafety(last.safetyM);
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const left = sorted[i];
    const right = sorted[i + 1];
    if (km < left.distanceKm || km > right.distanceKm) continue;
    const span = right.distanceKm - left.distanceKm;
    if (span < KM_EPS) {
      return finiteSafety(left.safetyM) ?? finiteSafety(right.safetyM);
    }
    const t = (km - left.distanceKm) / span;
    const y0 = finiteSafety(left.safetyM);
    const y1 = finiteSafety(right.safetyM);
    if (y0 != null && y1 != null) return y0 + t * (y1 - y0);
    return y0 ?? y1;
  }

  return null;
}

function finiteSafety(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value;
}
