import type {
  ExpressionSpecification,
  MapLayerMouseEvent,
  Map as MaplibreMap
} from 'maplibre-gl';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
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
  AIRSPACE_WIREFRAME_LAYER_ID,
  buildAirspaceWireframeSpecs
} from './airspace-wireframe.util';

type AirspaceWireframeLayer = import('./airspace-wireframe-three-layer.util').AirspaceWireframeThreeCustomLayer;

const wireframeLayersByMap = new WeakMap<MaplibreMap, AirspaceWireframeLayer>();

const AIRSPACE_EDGE_WIDTH: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  8,
  1.5,
  12,
  2.25,
  16,
  3
];

const AIRSPACE_EDGE_HALO_WIDTH: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  8,
  3,
  12,
  4.5,
  16,
  5.5
];

const AIRSPACE_CLICK_LAYERS = [
  MAP_LAYER.AIRSPACE_FILL,
  MAP_LAYER.AIRSPACE_EXTRUSION,
  MAP_LAYER.AIRSPACE_HIT_FILL,
  MAP_LAYER.AIRSPACE_LINE_HALO,
  MAP_LAYER.AIRSPACE_LINE
] as const;

const airspaceEdgeColor: ExpressionSpecification = ['coalesce', ['get', 'stroke'], '#c026d3'];

let clickHandler: ((e: MapLayerMouseEvent) => void) | null = null;
let enterHandler: (() => void) | null = null;
let leaveHandler: (() => void) | null = null;

function removeAirspaceWireframeLayer(map: MaplibreMap): void {
  const layer = wireframeLayersByMap.get(map);
  if (layer) {
    layer.setVisible(false);
    layer.setSpecs([]);
    if (map.getLayer(AIRSPACE_WIREFRAME_LAYER_ID)) {
      map.removeLayer(AIRSPACE_WIREFRAME_LAYER_ID);
    }
    wireframeLayersByMap.delete(map);
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
    const { createAirspaceWireframeCustomLayer } = await import(
      './airspace-wireframe-three-layer.util'
    );
    layer = createAirspaceWireframeCustomLayer();
    wireframeLayersByMap.set(map, layer);
    if (!map.getLayer(AIRSPACE_WIREFRAME_LAYER_ID)) {
      map.addLayer(layer, beforeLayerId);
    }
  }

  layer.setSpecs(specs);
  layer.setVisible(true);
}

export function removeAirspaceLayersFromMap(map: MaplibreMap): void {
  unbindAirspaceClickHandlers(map);
  removeAirspaceWireframeLayer(map);

  for (const layerId of [
    MAP_LAYER.AIRSPACE_EXTRUSION,
    MAP_LAYER.AIRSPACE_HIT_FILL,
    MAP_LAYER.AIRSPACE_FILL,
    MAP_LAYER.AIRSPACE_LINE,
    MAP_LAYER.AIRSPACE_LINE_HALO,
    MAP_LAYER.OPENAIP_RASTER
  ]) {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
  }
  for (const sourceId of [
    MAP_SOURCE.AIRSPACE,
    MAP_SOURCE.AIRSPACE_EDGES,
    MAP_SOURCE.OPENAIP
  ]) {
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  }
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
        'line-color': '#ffffff',
        'line-width': AIRSPACE_EDGE_HALO_WIDTH,
        'line-opacity': 0.85
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
        'line-color': airspaceEdgeColor,
        'line-width': AIRSPACE_EDGE_WIDTH,
        'line-opacity': 0.95
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
    onFeatureClick?: (e: MapLayerMouseEvent) => void;
  }
): Promise<void> {
  removeAirspaceLayersFromMap(map);

  if (!options.volume3d && result.source === 'openaip' && result.rasterTileUrl) {
    map.addSource(MAP_SOURCE.OPENAIP, {
      type: 'raster',
      tiles: [result.rasterTileUrl],
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

  const edges = buildAirspaceBoundaryLineCollection(geojson);

  map.addSource(MAP_SOURCE.AIRSPACE, {
    type: 'geojson',
    data: geojson
  });

  if (options.volume3d) {
    map.addLayer(
      {
        id: MAP_LAYER.AIRSPACE_HIT_FILL,
        type: 'fill',
        source: MAP_SOURCE.AIRSPACE,
        filter: ['==', ['get', 'hasVolume'], true],
        paint: {
          'fill-color': '#000000',
          'fill-opacity': 0
        }
      },
      options.beforeLayerId
    );
    await applyAirspaceWireframeLayer(map, geojson, options.beforeLayerId);
    const flatFeatures = geojson.features.filter(f => f.properties?.hasVolume !== true);
    if (flatFeatures.length > 0) {
      addAirspaceEdgeLayers(
        map,
        buildAirspaceBoundaryLineCollection({
          type: 'FeatureCollection',
          features: flatFeatures
        }),
        options.beforeLayerId
      );
    }
  } else {
    map.addLayer(
      {
        id: MAP_LAYER.AIRSPACE_FILL,
        type: 'fill',
        source: MAP_SOURCE.AIRSPACE,
        paint: {
          'fill-color': ['coalesce', ['get', 'fill'], '#f0abfc'],
          'fill-opacity': [
            'min',
            ['*', ['coalesce', ['get', 'fill-opacity'], 0.45], 0.55],
            0.45
          ],
          'fill-outline-color': airspaceEdgeColor,
          'fill-antialias': true
        }
      },
      options.beforeLayerId
    );
    addAirspaceEdgeLayers(map, edges, options.beforeLayerId);
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
