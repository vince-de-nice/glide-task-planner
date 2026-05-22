import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  Position
} from 'geojson';
import type { AirspaceVolumeProperties } from './airspace-volume-enrich.util';

/** Contours fermés (arêtes) de chaque polygone POAFF pour calques `line`. */
export function buildAirspaceBoundaryLineCollection(
  collection: FeatureCollection<Geometry, AirspaceVolumeProperties>
): FeatureCollection<LineString, AirspaceVolumeProperties> {
  const features: Feature<LineString, AirspaceVolumeProperties>[] = [];

  for (const feature of collection.features) {
    const rings = exteriorRings(feature.geometry);
    if (rings.length === 0) continue;
    const props = feature.properties ?? ({} as AirspaceVolumeProperties);

    for (const ring of rings) {
      if (ring.length < 2) continue;
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: closeRing(ring)
        },
        properties: { ...props }
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

function exteriorRings(geometry: Geometry): Position[][] {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.length > 0 ? [geometry.coordinates[0]] : [];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates
      .map(poly => (poly.length > 0 ? poly[0] : null))
      .filter((ring): ring is Position[] => ring != null);
  }
  return [];
}

/** Ferme le contour pour un tracé `line` continu. */
function closeRing(ring: Position[]): Position[] {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return ring;
  }
  return [...ring, first];
}
