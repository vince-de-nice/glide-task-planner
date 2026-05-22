/**
 * GeoJSON pour les points de la coupe sur la carte profil de sécurité.
 * Les cônes 3D sont rendus via le calque custom Three.js (safety-cone-three-layer.util.ts).
 */
import type { Feature, FeatureCollection, Point } from 'geojson';
import { SAFETY_PROFILE_SEMANTIC } from './safety-profile-palette.util';

export interface ProfileLegMapPoint {
  id: string;
  role: 'from' | 'to' | 'landable';
  longitude: number;
  latitude: number;
  label: string;
  color: string;
}

export interface ProfileLegMapPointsInput {
  from: { longitude: number; latitude: number; name: string };
  to: { longitude: number; latitude: number; name: string };
  landables: ProfileLegMapPoint[];
}

/** Points de la coupe (extrémités + terrains posables actifs). */
export function buildProfileLegPointsGeoJson(
  input: ProfileLegMapPointsInput
): FeatureCollection<Point> {
  const features: Feature<Point>[] = [
    pointFeature(input.from.longitude, input.from.latitude, {
      role: 'from',
      label: input.from.name,
      color: SAFETY_PROFILE_SEMANTIC.legEndpoint
    }),
    pointFeature(input.to.longitude, input.to.latitude, {
      role: 'to',
      label: input.to.name,
      color: SAFETY_PROFILE_SEMANTIC.legEndpoint
    })
  ];
  for (const la of input.landables) {
    features.push(
      pointFeature(la.longitude, la.latitude, {
        role: 'landable',
        label: la.label,
        color: la.color,
        landableId: la.id
      })
    );
  }
  return { type: 'FeatureCollection', features };
}

function pointFeature(
  lng: number,
  lat: number,
  props: Record<string, string>
): Feature<Point> {
  return {
    type: 'Feature',
    properties: props,
    geometry: { type: 'Point', coordinates: [lng, lat] }
  };
}
