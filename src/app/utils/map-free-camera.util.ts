import type { Map as MaplibreMap } from 'maplibre-gl';

/** Pitch max pratique (MapLibre : > 60° peut être instable au rendu). */
export const MAP_FREE_CAMERA_MAX_PITCH = 85;

/**
 * Désactive le clamp de la caméra au relief (DEM) et ouvre pitch / roll.
 * Le DEM reste actif pour l’altitude au curseur et les volumes 3D.
 */
export function configureMapFreeCamera(map: MaplibreMap): void {
  map.setCenterClampedToGround(false);
  map.setMinPitch(0);
  map.setMaxPitch(MAP_FREE_CAMERA_MAX_PITCH);

  // MapLibre 5 : remonte pitch/zoom si l’œil passe sous le MNT — on neutralise.
  const internal = map as MaplibreMap & {
    _elevateCameraIfInsideTerrain?: (tr: unknown) => Record<string, never>;
  };
  if (typeof internal._elevateCameraIfInsideTerrain === 'function') {
    internal._elevateCameraIfInsideTerrain = () => ({});
  }
}
