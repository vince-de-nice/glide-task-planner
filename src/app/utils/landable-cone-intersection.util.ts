import type {
  LandableConeSample,
  LandableConeVisual
} from '../services/glide-envelope.service';

/** Marge ajoutée au rayon 3D après la plus grande intersection entre cônes sur la coupe. */
export const MAP_CONE_RADIUS_MARGIN_KM = 2.5;

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

/**
 * Rayon horizontal du cône 3D (km) = plus grande distance d'intersection avec un autre cône + marge.
 */
export function assignMapDisplayRadii(
  cones: LandableConeVisual[],
  halfRatio: number,
  marginKm = MAP_CONE_RADIUS_MARGIN_KM
): void {
  for (const cone of cones) {
    let maxIntersectionReachKm = 0;

    for (const other of cones) {
      if (other.id === cone.id) continue;

      for (const hit of findCurvePairCrossings(cone.curve, other.curve)) {
        const reachKm = coneHorizontalReachKm(
          cone.baseAltitudeM,
          hit.altitudeM,
          halfRatio
        );
        if (reachKm > maxIntersectionReachKm) {
          maxIntersectionReachKm = reachKm;
        }
      }
    }

    cone.mapDisplayRadiusKm = maxIntersectionReachKm + marginKm;
    cone.mapTopAltitudeM =
      cone.baseAltitudeM + (cone.mapDisplayRadiusKm * 1000) / halfRatio;
  }
}
