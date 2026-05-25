import type { GeoJSONSource, MapLayerMouseEvent, Map as MaplibreMap } from 'maplibre-gl';
import type { FeatureCollection, Geometry } from 'geojson';
import {
  MAP_LAYER,
  MAP_SOURCE,
  reorderMapOverlayLayers
} from '../components/map-view/map-style.constants';
import type { AirspaceLoadResult } from '../services/airspace-layer.service';
import type { PoaffProperties } from '../services/airspace-layer.service';
import type { AirspaceVolumeProperties } from './airspace-volume-enrich.util';
import { buildAirspaceBoundaryLineCollection } from './airspace-boundary-lines.util';
import {
  AIRSPACE_VIEWPORT_CULLING_ENABLED,
  filterAirspaceFeaturesForViewport
} from './airspace-wireframe-perf.util';
import {
  AIRSPACE_WIREFRAME_LAYER_ID,
  buildAirspaceWireframeSpecs
} from './airspace-wireframe.util';
import { geoJsonFlagEq } from './map-expression.util';
import {
  enrichAirspaceCollectionVfrStyles,
  type AirspaceFeatureProperties,
  airspaceVfrHaloWidthExpression,
  airspaceVfrLineDashExpression,
  airspaceVfrLineWidthExpression
} from './airspace-vfr-style.util';
import {
  isMapStyleActive,
  registerMapTeardown,
  withActiveMap
} from './map-runtime.util';

type AirspaceWireframeLayer = import('./airspace-wireframe-three-layer.util').AirspaceWireframeThreeCustomLayer;

const wireframeLayersByMap = new WeakMap<MaplibreMap, AirspaceWireframeLayer>();
const airspaceTeardownRegistered = new WeakSet<MaplibreMap>();
const fullAirspaceByMap = new WeakMap<
  MaplibreMap,
  FeatureCollection<Geometry, AirspaceFeatureProperties>
>();
const viewportSyncHandlerByMap = new WeakMap<MaplibreMap, () => void>();

const AIRSPACE_CLICK_LAYERS = [
  MAP_LAYER.AIRSPACE_FILL,
  MAP_LAYER.AIRSPACE_EXTRUSION,
  MAP_LAYER.AIRSPACE_HIT_FILL,
  MAP_LAYER.AIRSPACE_LINE_HALO,
  MAP_LAYER.AIRSPACE_LINE
] as const;

let clickHandler: ((e: MapLayerMouseEvent) => void) | null = null;
let enterHandler: (() => void) | null = null;
let leaveHandler: (() => void) | null = null;

/** Libère le calque Three.js sans appeler l’API carte (carte déjà détruite). */
function detachAirspaceWireframeState(map: MaplibreMap): void {
  const layer = wireframeLayersByMap.get(map);
  if (!layer) return;
  wireframeLayersByMap.delete(map);
  layer.dispose();
}

function removeAirspaceWireframeLayer(map: MaplibreMap): void {
  const layer = wireframeLayersByMap.get(map);
  if (!layer) return;

  layer.setVisible(false);
  wireframeLayersByMap.delete(map);

  const removed = withActiveMap(map, active => {
    if (active.getLayer(AIRSPACE_WIREFRAME_LAYER_ID)) {
      active.removeLayer(AIRSPACE_WIREFRAME_LAYER_ID);
      return true;
    }
    return false;
  });

  if (!removed) {
    layer.dispose();
  }
}

function detachAirspaceMapState(map: MaplibreMap): void {
  unbindAirspaceClickHandlers(map);
  unbindAirspaceViewportSync(map);
  if (isMapStyleActive(map)) {
    removeAirspaceWireframeLayer(map);
  } else {
    detachAirspaceWireframeState(map);
  }
}

async function applyAirspaceWireframeLayer(
  map: MaplibreMap,
  geojson: FeatureCollection<Geometry, AirspaceVolumeProperties>,
  beforeLayerId: string
): Promise<void> {
  const specs = buildAirspaceWireframeSpecs(geojson);
  let layer = wireframeLayersByMap.get(map);

  if (specs.length === 0) {
    if (layer) {
      layer.setSpecs([]);
      layer.setVisible(false);
    }
    return;
  }

  if (!layer) {
    if (map.getLayer(AIRSPACE_WIREFRAME_LAYER_ID)) {
      map.removeLayer(AIRSPACE_WIREFRAME_LAYER_ID);
    }
    const { createAirspaceWireframeCustomLayer } = await import(
      './airspace-wireframe-three-layer.util'
    );
    layer = createAirspaceWireframeCustomLayer();
    wireframeLayersByMap.set(map, layer);
    map.addLayer(layer, beforeLayerId);
  }

  layer.setSpecs(specs);
  layer.setVisible(true);
}

function viewportAirspaceCollection(
  map: MaplibreMap,
  full: FeatureCollection<Geometry, AirspaceFeatureProperties>
): FeatureCollection<Geometry, AirspaceFeatureProperties> {
  return {
    type: 'FeatureCollection',
    features: filterAirspaceFeaturesForViewport(full.features, map)
  };
}

function buildVisibleEdgeCollection(
  visible: FeatureCollection<Geometry, AirspaceFeatureProperties>
): ReturnType<typeof buildAirspaceBoundaryLineCollection> {
  if (visible.features.length === 0) {
    return { type: 'FeatureCollection', features: [] };
  }
  return buildAirspaceBoundaryLineCollection(visible);
}

function refreshAirspaceViewportData(map: MaplibreMap): void {
  if (!isMapStyleActive(map)) return;
  const full = fullAirspaceByMap.get(map);
  if (!full) return;

  const visible = viewportAirspaceCollection(map, full);
  const main = map.getSource(MAP_SOURCE.AIRSPACE);
  if (main && 'setData' in main) {
    (main as GeoJSONSource).setData(visible);
  }

  const edgeSrc = map.getSource(MAP_SOURCE.AIRSPACE_EDGES);
  if (edgeSrc && 'setData' in edgeSrc) {
    (edgeSrc as GeoJSONSource).setData(buildVisibleEdgeCollection(visible));
  }
}

function bindAirspaceViewportSync(map: MaplibreMap): void {
  if (!AIRSPACE_VIEWPORT_CULLING_ENABLED) return;
  if (!isMapStyleActive(map) || viewportSyncHandlerByMap.has(map)) return;

  let raf = 0;
  let lastBoundsKey = '';
  const handler = (): void => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const b = map.getBounds();
      const key = b
        ? `${b.getWest().toFixed(5)},${b.getSouth().toFixed(5)},${b.getEast().toFixed(5)},${b.getNorth().toFixed(5)},${map.getZoom().toFixed(2)}`
        : '';
      if (key === lastBoundsKey) return;
      lastBoundsKey = key;
      refreshAirspaceViewportData(map);
    });
  };
  viewportSyncHandlerByMap.set(map, handler);
  map.on('moveend', handler);
}

function unbindAirspaceViewportSync(map: MaplibreMap): void {
  const handler = viewportSyncHandlerByMap.get(map);
  if (handler) {
    try {
      map.off('moveend', handler);
    } catch {
      /* carte détruite */
    }
    viewportSyncHandlerByMap.delete(map);
  }
  fullAirspaceByMap.delete(map);
}

/** Retire les calques et libère l’état interne ; tolère une carte déjà détruite. */
export function removeAirspaceLayersFromMap(map: MaplibreMap | null | undefined): void {
  if (!map) return;

  detachAirspaceMapState(map);

  if (!isMapStyleActive(map)) return;

  withActiveMap(map, active => {
    for (const layerId of [
      MAP_LAYER.AIRSPACE_EXTRUSION,
      MAP_LAYER.AIRSPACE_HIT_FILL,
      MAP_LAYER.AIRSPACE_FILL,
      MAP_LAYER.AIRSPACE_LINE,
      MAP_LAYER.AIRSPACE_LINE_HALO,
      MAP_LAYER.OPENAIP_RASTER
    ]) {
      if (active.getLayer(layerId)) active.removeLayer(layerId);
    }
    for (const sourceId of [
      MAP_SOURCE.AIRSPACE,
      MAP_SOURCE.AIRSPACE_EDGES,
      MAP_SOURCE.OPENAIP
    ]) {
      if (active.getSource(sourceId)) active.removeSource(sourceId);
    }
  });
}

export function registerAirspaceMapTeardown(map: MaplibreMap): void {
  if (airspaceTeardownRegistered.has(map)) return;
  airspaceTeardownRegistered.add(map);
  registerMapTeardown(map, () => {
    airspaceTeardownRegistered.delete(map);
    detachAirspaceMapState(map);
  });
}

function addAirspaceEdgeLayers(
  map: MaplibreMap,
  edges: ReturnType<typeof buildAirspaceBoundaryLineCollection>,
  beforeLayerId: string
): void {
  map.addSource(MAP_SOURCE.AIRSPACE_EDGES, {
    type: 'geojson',
    data: edges
  });
  map.addLayer(
    {
      id: MAP_LAYER.AIRSPACE_LINE_HALO,
      type: 'line',
      source: MAP_SOURCE.AIRSPACE_EDGES,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['get', 'vfrStroke'],
        'line-width': airspaceVfrHaloWidthExpression(),
        'line-opacity': 0.42
      }
    },
    beforeLayerId
  );
  map.addLayer(
    {
      id: MAP_LAYER.AIRSPACE_LINE,
      type: 'line',
      source: MAP_SOURCE.AIRSPACE_EDGES,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['get', 'vfrStroke'],
        'line-width': airspaceVfrLineWidthExpression(),
        'line-opacity': 0.95,
        'line-dasharray': airspaceVfrLineDashExpression()
      }
    },
    beforeLayerId
  );
}

export async function applyAirspaceLayersToMap(
  map: MaplibreMap,
  result: AirspaceLoadResult,
  geojson: FeatureCollection<Geometry, AirspaceVolumeProperties>,
  options: {
    beforeLayerId: string;
    volume3d: boolean;
    /** Profil sécurité : ne pas remplacer par le raster OpenAIP global. */
    legScopedDisplay?: boolean;
    onFeatureClick?: (e: MapLayerMouseEvent) => void;
  }
): Promise<void> {
  removeAirspaceLayersFromMap(map);
  registerAirspaceMapTeardown(map);

  const rasterTileUrl = result.rasterTileUrl;
  const useOpenAipRaster =
    !options.volume3d &&
    !options.legScopedDisplay &&
    result.source === 'openaip' &&
    rasterTileUrl;

  if (useOpenAipRaster && rasterTileUrl) {
    map.addSource(MAP_SOURCE.OPENAIP, {
      type: 'raster',
      tiles: [rasterTileUrl],
      tileSize: 256,
      scheme: 'tms',
      maxzoom: 14
    });
    map.addLayer(
      {
        id: MAP_LAYER.OPENAIP_RASTER,
        type: 'raster',
        source: MAP_SOURCE.OPENAIP,
        paint: { 'raster-opacity': 0.72 }
      },
      options.beforeLayerId
    );
    reorderMapOverlayLayers(map);
    return;
  }

  const styled = enrichAirspaceCollectionVfrStyles(geojson);
  fullAirspaceByMap.set(map, styled);
  const visible = viewportAirspaceCollection(map, styled);

  map.addSource(MAP_SOURCE.AIRSPACE, {
    type: 'geojson',
    data: visible
  });
  bindAirspaceViewportSync(map);

  if (options.volume3d) {
    map.addLayer(
      {
        id: MAP_LAYER.AIRSPACE_HIT_FILL,
        type: 'fill',
        source: MAP_SOURCE.AIRSPACE,
        filter: geoJsonFlagEq('hasVolume'),
        paint: {
          'fill-color': '#000000',
          'fill-opacity': 0
        }
      },
      options.beforeLayerId
    );
    await applyAirspaceWireframeLayer(map, styled, options.beforeLayerId);
    const visibleEdges = buildVisibleEdgeCollection(visible);
    if (visibleEdges.features.length > 0) {
      addAirspaceEdgeLayers(map, visibleEdges, options.beforeLayerId);
    }
  } else {
    map.addLayer(
      {
        id: MAP_LAYER.AIRSPACE_FILL,
        type: 'fill',
        source: MAP_SOURCE.AIRSPACE,
        paint: {
          'fill-color': '#000000',
          'fill-opacity': 0
        }
      },
      options.beforeLayerId
    );
    const visibleEdges = buildVisibleEdgeCollection(visible);
    if (visibleEdges.features.length > 0) {
      addAirspaceEdgeLayers(map, visibleEdges, options.beforeLayerId);
    }
    removeAirspaceWireframeLayer(map);
  }

  reorderMapOverlayLayers(map);

  if (options.onFeatureClick) {
    bindAirspaceClickHandlers(map, options.onFeatureClick);
  }
}

function bindAirspaceClickHandlers(
  map: MaplibreMap,
  handler: (e: MapLayerMouseEvent) => void
): void {
  clickHandler = handler;
  enterHandler = () => {
    map.getCanvas().style.cursor = 'pointer';
  };
  leaveHandler = () => {
    map.getCanvas().style.cursor = '';
  };

  for (const layerId of AIRSPACE_CLICK_LAYERS) {
    if (!map.getLayer(layerId)) continue;
    map.on('click', layerId, clickHandler);
    map.on('mouseenter', layerId, enterHandler);
    map.on('mouseleave', layerId, leaveHandler);
  }
}

export function unbindAirspaceClickHandlers(map: MaplibreMap): void {
  if (!clickHandler) return;
  for (const layerId of AIRSPACE_CLICK_LAYERS) {
    try {
      if (clickHandler) map.off('click', layerId, clickHandler);
      if (enterHandler) map.off('mouseenter', layerId, enterHandler);
      if (leaveHandler) map.off('mouseleave', layerId, leaveHandler);
    } catch {
      /* ignore */
    }
  }
  clickHandler = null;
  enterHandler = null;
  leaveHandler = null;
}
