import type { Feature, FeatureCollection, Point } from 'geojson';
import { formatMetersDisplay } from './airspace-altitude.util';
import { destinationPoint } from './obs-zone-map.util';
import { landableMapLabelColorFromHex } from './safety-profile-palette.util';
import {
  coneSurfaceRingDiametersKm,
  type SafetyConeMeshSpec
} from './safety-cone-three-layer.util';

/** Cap vers l'est (axe O–E) pour placer le libellé sur le cercle. */
const LABEL_BEARING_EAST_DEG = 90;

/** Arrondi à la cinquantaine de mètres supérieure (ex. 2430 → 2450). */
export function roundAltitudeToUpper50M(altitudeM: number): number {
  return Math.ceil(altitudeM / 50) * 50;
}

export function formatConeRingAltitudeLabel(altitudeM: number): string {
  return formatMetersDisplay(roundAltitudeToUpper50M(altitudeM));
}

/**
 * Altitude MSL sur la surface du cône à la distance horizontale `diameterKm/2` du sommet.
 */
export function coneSafetyAltitudeAtRingDiameterM(
  tipAltitudeM: number,
  topAltitudeM: number,
  diameterKm: number,
  halfRatio: number
): number | null {
  const radiusKm = diameterKm / 2;
  const ySliceM = (radiusKm * 1000) / halfRatio;
  const heightM = topAltitudeM - tipAltitudeM;
  if (ySliceM <= 0 || ySliceM >= heightM) return null;
  return tipAltitudeM + ySliceM;
}

/** Points de libellé (côté est de chaque anneau de distance du cône). */
export function buildConeRingLabelsGeoJson(
  specs: readonly SafetyConeMeshSpec[]
): FeatureCollection<Point> {
  const features: Feature<Point>[] = [];

  for (const spec of specs) {
    for (const diameterKm of coneSurfaceRingDiametersKm(spec.mapDisplayRadiusKm)) {
      const altitudeM = coneSafetyAltitudeAtRingDiameterM(
        spec.tipAltitudeM,
        spec.topAltitudeM,
        diameterKm,
        spec.halfRatio
      );
      if (altitudeM == null) continue;

      const radiusM = (diameterKm / 2) * 1000;
      const [lat, lon] = destinationPoint(
        spec.latitude,
        spec.longitude,
        LABEL_BEARING_EAST_DEG,
        radiusM
      );

      features.push({
        type: 'Feature',
        properties: {
          label: formatConeRingAltitudeLabel(altitudeM),
          color: landableMapLabelColorFromHex(spec.color),
          coneId: spec.id,
          diameterKm: String(diameterKm)
        },
        geometry: {
          type: 'Point',
          coordinates: [lon, lat]
        }
      });
    }
  }

  return { type: 'FeatureCollection', features };
}
