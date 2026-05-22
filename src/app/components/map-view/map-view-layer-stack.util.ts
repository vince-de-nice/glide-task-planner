/** Ordre de superposition des calques métier sur la carte déclaration (bas → haut). */
export const MAP_LAYER_STACK_ORDER = [
  'gc-map-terrain-hillshade',
  'gc-map-task-lines',
  'gc-map-task-lines-hit',
  'gc-map-obs-zones-fill',
  'gc-map-obs-zones-outline',
  'gc-map-catalog-clusters',
  'gc-map-catalog-dots',
  'gc-map-waypoints',
  'gc-map-waypoint-labels'
] as const;
