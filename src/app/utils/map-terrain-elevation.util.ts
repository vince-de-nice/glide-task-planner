import type { Map as MaplibreMap } from 'maplibre-gl';

/** Altitude terrain MSL (m) au point lng/lat, arrondie ; `undefined` si DEM indisponible. */
export function queryTerrainElevationM(
  map: MaplibreMap | null | undefined,
  lng: number,
  lat: number
): number | undefined {
  if (!map) return undefined;
  try {
    const raw = map.queryTerrainElevation([lng, lat]);
    if (raw == null || !Number.isFinite(raw)) return undefined;
    return Math.round(raw);
  } catch {
    return undefined;
  }
}

/**
 * Interroge le relief puis réessaie une fois après `idle` si les tuiles DEM ne sont pas prêtes.
 * Retourne une fonction d’annulation (fermeture dialogue, etc.).
 */
export function lookupTerrainElevationM(
  map: MaplibreMap | null | undefined,
  lng: number,
  lat: number,
  onResult: (elevationM: number | undefined) => void
): () => void {
  if (!map) {
    onResult(undefined);
    return () => undefined;
  }

  const tryOnce = (): number | undefined =>
    queryTerrainElevationM(map, lng, lat);

  const first = tryOnce();
  if (first != null) {
    onResult(first);
    return () => undefined;
  }

  const onIdle = (): void => {
    map.off('idle', onIdle);
    onResult(tryOnce());
  };
  map.once('idle', onIdle);
  return () => {
    map.off('idle', onIdle);
  };
}
