import type { EnvelopeSample, LandableConeVisual } from '../services/glide-envelope.service';
import { bearingDegrees, destinationPoint } from './obs-zone-map.util';

const HORIZONTAL_PAD_KM = 0.5;
const VERTICAL_PAD_M = 200;
const CIRCLE_SAMPLES = 12;

export interface LegEvolutionEnvelope {
  west: number;
  south: number;
  east: number;
  north: number;
  /** Plancher MSL du volume d'évolution (m). */
  floorM: number;
  /** Plafond MSL du volume d'évolution (m). */
  ceilingM: number;
}

export interface LegEvolutionEnvelopeInput {
  fromLng: number;
  fromLat: number;
  toLng: number;
  toLat: number;
  legLengthKm: number;
  profileStartKm: number;
  profileEndKm: number;
  samples: readonly EnvelopeSample[];
  landableCones: readonly LandableConeVisual[];
  enabledLandableIds: ReadonlySet<string>;
  /** Sommet de chaque cône actif [lng, lat]. */
  landableApexLngLat: ReadonlyMap<string, [number, number]>;
}

/**
 * Périmètre d'évolution (invisible) : union des cônes de local activés
 * (rayon horizontal + hauteur) et de l'enveloppe de sécurité sur la coupe.
 */
export function computeLegEvolutionEnvelope(
  input: LegEvolutionEnvelopeInput
): LegEvolutionEnvelope {
  const lngs: number[] = [input.fromLng, input.toLng];
  const lats: number[] = [input.fromLat, input.toLat];

  const legBearing = bearingDegrees(
    input.fromLat,
    input.fromLng,
    input.toLat,
    input.toLng
  );

  for (const cone of input.landableCones) {
    if (!input.enabledLandableIds.has(cone.id)) continue;
    const radiusM = Math.max(cone.mapDisplayRadiusKm, 0.15) * 1000;
    const apex = input.landableApexLngLat.get(cone.id);
    if (!apex) continue;

    for (let i = 0; i < CIRCLE_SAMPLES; i++) {
      const bearing = (i * 360) / CIRCLE_SAMPLES;
      const [lat, lng] = destinationPoint(apex[1], apex[0], bearing, radiusM);
      lngs.push(lng);
      lats.push(lat);
    }

    const alongPadKm = cone.mapDisplayRadiusKm + HORIZONTAL_PAD_KM;
    pushAlongLegOffset(
      apex,
      legBearing,
      alongPadKm,
      lngs,
      lats
    );
    pushAlongLegOffset(
      apex,
      legBearing,
      -alongPadKm,
      lngs,
      lats
    );
  }

  for (const s of input.samples) {
    if (s.distanceKm < input.profileStartKm - 0.01) continue;
    if (s.distanceKm > input.profileEndKm + 0.01) continue;
    lngs.push(s.longitude);
    lats.push(s.latitude);
  }

  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (let i = 0; i < lngs.length; i++) {
    west = Math.min(west, lngs[i]);
    east = Math.max(east, lngs[i]);
    south = Math.min(south, lats[i]);
    north = Math.max(north, lats[i]);
  }

  const padM = HORIZONTAL_PAD_KM * 1000;
  const cLng = (west + east) / 2;
  const cLat = (south + north) / 2;
  for (const bearing of [0, 90, 180, 270]) {
    const [lat, lng] = destinationPoint(cLat, cLng, bearing, padM);
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }

  let floorM = 0;
  let ceilingM = 500;
  for (const cone of input.landableCones) {
    if (!input.enabledLandableIds.has(cone.id)) continue;
    floorM = Math.min(floorM, cone.elevationM);
    ceilingM = Math.max(ceilingM, cone.mapTopAltitudeM);
  }

  for (const s of input.samples) {
    if (s.distanceKm < input.profileStartKm - 0.01) continue;
    if (s.distanceKm > input.profileEndKm + 0.01) continue;
    if (s.terrainM != null && Number.isFinite(s.terrainM)) {
      floorM = Math.min(floorM, s.terrainM);
    }
    if (s.safetyM != null && Number.isFinite(s.safetyM)) {
      ceilingM = Math.max(ceilingM, s.safetyM);
    }
    if (s.glideConeM != null && Number.isFinite(s.glideConeM)) {
      ceilingM = Math.max(ceilingM, s.glideConeM);
    }
  }

  return {
    west,
    south,
    east,
    north,
    floorM: floorM - VERTICAL_PAD_M,
    ceilingM: ceilingM + VERTICAL_PAD_M
  };
}

function pushAlongLegOffset(
  apex: [number, number],
  legBearing: number,
  alongKm: number,
  lngs: number[],
  lats: number[]
): void {
  const [lat, lng] = destinationPoint(apex[1], apex[0], legBearing, alongKm * 1000);
  lngs.push(lng);
  lats.push(lat);
}
