import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  Position
} from 'geojson';
import type { AirspaceVolumeProperties } from './airspace-volume-enrich.util';
import {
  buildWireframeVerticalModel,
  prepareAirspaceFootprintRing
} from './airspace-wireframe.util';

/** Contours fermés (arêtes) de chaque polygone POAFF pour calques `line`. */
export function buildAirspaceBoundaryLineCollection(
  collection: FeatureCollection<Geometry, AirspaceVolumeProperties>
): FeatureCollection<LineString, AirspaceVolumeProperties> {
  const features: Feature<LineString, AirspaceVolumeProperties>[] = [];

  for (const feature of collection.features) {
    const rings = exteriorRings(feature.geometry);
    if (rings.length === 0) continue;
    const props = feature.properties ?? ({} as AirspaceVolumeProperties);
    const vertical = props.hasVolume ? buildWireframeVerticalModel(props) : null;
    const needsTerrain = !!(
      vertical &&
      (vertical.useTerrainBase || vertical.useTerrainTop)
    );

    for (const ring of rings) {
      const open = openExteriorRing(ring);
      if (open.length < 2) continue;
      const footprint = prepareAirspaceFootprintRing(open, needsTerrain);
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: closeRing(
            footprint.map(p => [p.lng, p.lat] as Position)
          )
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

function openExteriorRing(ring: Position[]): { lng: number; lat: number }[] {
  const pts = ring.map(p => ({ lng: p[0], lat: p[1] }));
  if (pts.length > 1) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first.lng === last.lng && first.lat === last.lat) {
      pts.pop();
    }
  }
  return pts;
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
