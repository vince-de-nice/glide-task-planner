import type { Map as MaplibreMap } from 'maplibre-gl';

export type MapTeardown = () => void;

const teardownsByMap = new WeakMap<MaplibreMap, MapTeardown[]>();

/** Carte encore utilisable (style chargé, pas déjà retirée du DOM). */
export function isMapStyleActive(map: MaplibreMap | null | undefined): map is MaplibreMap {
  if (!map) return false;
  try {
    if (typeof map.getStyle !== 'function') return false;
    const style = map.getStyle();
    if (style == null) return false;
    const removed = (map as { _removed?: boolean })._removed;
    return removed !== true;
  } catch {
    return false;
  }
}

/** Exécute une opération MapLibre uniquement si la carte est encore active. */
export function withActiveMap<T>(
  map: MaplibreMap | null | undefined,
  fn: (active: MaplibreMap) => T
): T | undefined {
  if (!isMapStyleActive(map)) return undefined;
  try {
    return fn(map);
  } catch {
    return undefined;
  }
}

/** Nettoyage interne (WeakMaps, listeners) à la destruction de la carte. */
export function registerMapTeardown(map: MaplibreMap, teardown: MapTeardown): void {
  const list = teardownsByMap.get(map) ?? [];
  list.push(teardown);
  teardownsByMap.set(map, list);

  if ((map as { __gcTeardownBound?: boolean }).__gcTeardownBound) return;
  (map as { __gcTeardownBound?: boolean }).__gcTeardownBound = true;

  map.once('remove', () => {
    runMapTeardowns(map);
  });
}

export function runMapTeardowns(map: MaplibreMap): void {
  const list = teardownsByMap.get(map);
  if (!list?.length) return;
  teardownsByMap.delete(map);
  for (const fn of list) {
    try {
      fn();
    } catch {
      /* carte en cours de destruction */
    }
  }
}
