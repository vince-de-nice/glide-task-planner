import type { FeatureCollection, Geometry } from 'geojson';

export interface AirspaceZoneClassTypeProps {
  type?: string;
  class?: string;
}

/**
 * Zones POAFF de grande emprise (`class` AREA) ou géographiques (`type` GEO).
 * Exclues par défaut au chargement de la source (carte, profil sécurité, enrichissement).
 */
export function isAreaOrGeoAirspaceZone(
  props: AirspaceZoneClassTypeProps | undefined
): boolean {
  const type = (props?.type ?? '').trim().toUpperCase();
  const cls = (props?.class ?? '').trim().toUpperCase();
  return type === 'GEO' || cls === 'AREA';
}

export function filterAreaGeoFromAirspaceCollection<P extends AirspaceZoneClassTypeProps>(
  collection: FeatureCollection<Geometry, P>
): FeatureCollection<Geometry, P> {
  const features = collection.features.filter(
    f => !isAreaOrGeoAirspaceZone(f.properties)
  );
  return { type: 'FeatureCollection', features };
}
