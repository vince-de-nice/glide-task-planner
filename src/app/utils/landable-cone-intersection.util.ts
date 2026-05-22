import type {
  LandableConeSample,
  LandableConeVisual
} from '../services/glide-envelope.service';

/**
 * Recouvrement horizontal minimal entre cônes voisins sur la carte,
 * pour enchaîner de proche en proche le long de la branche sans excès.
 */
export const MAP_CONE_OVERLAP_KM = 0.8;

/** @deprecated Utiliser {@link MAP_CONE_OVERLAP_KM}. */
export const MAP_CONE_RADIUS_MARGIN_KM = MAP_CONE_OVERLAP_KM;

const ALONG_HANDOFF_EPS_KM = 0.05;

export interface ConeCurveCrossHit {
  distanceKm: number;
  altitudeM: number;
}

/** Distance horizontale (km) depuis le terrain posable jusqu'à l'altitude du cône. */
export function coneHorizontalReachKm(
  baseAltitudeM: number,
  altitudeM: number,
  halfRatio: number
): number {
  return Math.max(0, ((altitudeM - baseAltitudeM) * halfRatio) / 1000);
}

/**
 * Intersections de deux courbes de cône (même échantillons distanceKm sur la coupe).
 */
export function findCurvePairCrossings(
  curveA: LandableConeSample[],
  curveB: LandableConeSample[]
): ConeCurveCrossHit[] {
  const n = Math.min(curveA.length, curveB.length);
  if (n < 2) return [];

  const hits: ConeCurveCrossHit[] = [];
  for (let i = 1; i < n; i++) {
    const aA = curveA[i - 1];
    const aB = curveA[i];
    const bA = curveB[i - 1];
    const bB = curveB[i];
    if (Math.abs(aA.distanceKm - bA.distanceKm) > 0.01) continue;

    const fa = aA.altitudeM - bA.altitudeM;
    const fb = aB.altitudeM - bB.altitudeM;
    if (fa * fb >= 0) continue;

    const t = fa / (fa - fb);
    hits.push({
      distanceKm: aA.distanceKm + t * (aB.distanceKm - aA.distanceKm),
      altitudeM: aA.altitudeM + t * (aB.altitudeM - aA.altitudeM)
    });
  }
  return hits;
}

function crossingInHandoffSpan(
  hit: ConeCurveCrossHit,
  alongA: number,
  alongB: number
): boolean {
  const lo = Math.min(alongA, alongB) - ALONG_HANDOFF_EPS_KM;
  const hi = Math.max(alongA, alongB) + ALONG_HANDOFF_EPS_KM;
  return hit.distanceKm >= lo && hit.distanceKm <= hi;
}

/**
 * Point de passage le long de la branche avec un voisin :
 * intersection la plus proche du milieu d'intervalle, sinon ce milieu.
 */
function handoffAlongKmWithNeighbor(
  cone: LandableConeVisual,
  other: LandableConeVisual
): number {
  const mid = (cone.alongLegKm + other.alongLegKm) / 2;
  const lo = Math.min(cone.alongLegKm, other.alongLegKm) - ALONG_HANDOFF_EPS_KM;
  const hi = Math.max(cone.alongLegKm, other.alongLegKm) + ALONG_HANDOFF_EPS_KM;

  let best: number | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const hit of findCurvePairCrossings(cone.curve, other.curve)) {
    if (!crossingInHandoffSpan(hit, cone.alongLegKm, other.alongLegKm)) continue;
    const d = Math.abs(hit.distanceKm - mid);
    if (d < bestDist) {
      bestDist = d;
      best = hit.distanceKm;
    }
  }

  return best ?? mid;
}

/** Distance horizontale sommet → point le long de la branche (km + décalage latéral). */
function branchAxisReachKm(
  cone: LandableConeVisual,
  targetAlongKm: number
): number {
  return Math.hypot(
    Math.abs(targetAlongKm - cone.alongLegKm),
    cone.crossTrackKm
  );
}

/**
 * Rayon horizontal du cône 3D (km) pour la carte :
 *
 * 1. Voisins immédiats le long de la branche uniquement.
 * 2. Point de passage = intersection (proche du milieu d'intervalle) ou milieu.
 * 3. Rayon = max des portées vers chaque voisin + {@link MAP_CONE_OVERLAP_KM}.
 */
export function assignMapDisplayRadii(
  cones: LandableConeVisual[],
  halfRatio: number,
  overlapKm = MAP_CONE_OVERLAP_KM
): void {
  if (cones.length === 0) return;

  const sorted = [...cones].sort((a, b) => {
    if (a.alongLegKm !== b.alongLegKm) return a.alongLegKm - b.alongLegKm;
    return a.crossTrackKm - b.crossTrackKm;
  });

  for (let i = 0; i < sorted.length; i++) {
    const cone = sorted[i];
    const prev = i > 0 ? sorted[i - 1] : null;
    const next = i < sorted.length - 1 ? sorted[i + 1] : null;
    let maxReachKm = 0;

    for (const other of [prev, next].filter(
      (o): o is LandableConeVisual => o != null
    )) {
      const handoffAlong = handoffAlongKmWithNeighbor(cone, other);
      maxReachKm = Math.max(
        maxReachKm,
        branchAxisReachKm(cone, handoffAlong)
      );
    }

    if (maxReachKm === 0) {
      maxReachKm = Math.max(cone.crossTrackKm, 0.15);
    }

    cone.mapDisplayRadiusKm = maxReachKm + overlapKm;
    cone.mapTopAltitudeM =
      cone.baseAltitudeM + (cone.mapDisplayRadiusKm * 1000) / halfRatio;
  }
}
