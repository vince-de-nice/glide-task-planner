import type { ExpressionSpecification } from 'maplibre-gl';

/** Propriété booléenne GeoJSON sans null (MapLibre exige un booléen strict). */
export function geoJsonBool(
  property: string,
  defaultValue: boolean | number = false
): ExpressionSpecification {
  return ['coalesce', ['get', property], defaultValue];
}

export function geoJsonFlagEq(
  property: string,
  value: boolean | number = true
): ExpressionSpecification {
  return ['==', geoJsonBool(property), value];
}
