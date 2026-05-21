import type { Map as MaplibreMap, StyleSpecification } from 'maplibre-gl';

export type BasemapId =
  | 'esri-satellite'
  | 'esri-topo'
  | 'osm'
  | 'carto-voyager'
  | 'carto-light'
  | 'opentopo';

export interface BasemapRasterConfig {
  tiles: string[];
  attribution: string;
  maxzoom?: number;
  tileSize?: number;
}

export interface BasemapPreset {
  id: BasemapId;
  icon: string;
  labelKey: string;
  imagery: BasemapRasterConfig;
  /** Calque labels par-dessus l’imagerie (ex. Esri). */
  labels?: BasemapRasterConfig & { opacity?: number };
}

export const DEFAULT_BASEMAP_ID: BasemapId = 'esri-satellite';

export const BASEMAP_PRESETS: readonly BasemapPreset[] = [
  {
    id: 'esri-satellite',
    icon: 'pi pi-globe',
    labelKey: 'map.basemap.esriSatellite',
    imagery: {
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      attribution:
        'Imagerie &copy; <a href="https://www.esri.com/">Esri</a> — Esri, Maxar, Earthstar Geographics',
      maxzoom: 19
    },
    labels: {
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
      ],
      attribution: '',
      maxzoom: 19,
      opacity: 0.85
    }
  },
  {
    id: 'esri-topo',
    icon: 'pi pi-map',
    labelKey: 'map.basemap.esriTopo',
    imagery: {
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'
      ],
      attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
      maxzoom: 19
    }
  },
  {
    id: 'osm',
    icon: 'pi pi-compass',
    labelKey: 'map.basemap.osm',
    imagery: {
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxzoom: 19
    }
  },
  {
    id: 'carto-voyager',
    icon: 'pi pi-map-marker',
    labelKey: 'map.basemap.cartoVoyager',
    imagery: {
      tiles: ['https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'],
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxzoom: 19
    }
  },
  {
    id: 'carto-light',
    icon: 'pi pi-sun',
    labelKey: 'map.basemap.cartoLight',
    imagery: {
      tiles: ['https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxzoom: 19
    }
  },
  {
    id: 'opentopo',
    icon: 'pi pi-chart-line',
    labelKey: 'map.basemap.opentopo',
    imagery: {
      tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
      attribution:
        'Carte: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | Style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
      maxzoom: 17
    }
  }
] as const;

/** Option E — LOD catalogue : cluster sous ce zoom, points individuels au-delà. */
export const CATALOG_CLUSTER_MAX_ZOOM = 10;

/** Pastilles catalogue visibles à partir de ce zoom (sous le seuil cluster). */
export const CATALOG_DOT_MIN_ZOOM = 8;

/** Tuiles DEM Mapterhorn (Terrarium, 512 px) — voir https://mapterhorn.com/ */
export const MAPTERHORN_DEM_TILEJSON_URL = 'https://tiles.mapterhorn.com/tilejson.json';

export const MAP_TERRAIN_HILLSHADE_KEY = 'gc-map-terrain-hillshade';

export const MAP_SOURCE = {
  BASE_IMAGERY: 'base-imagery',
  BASE_LABELS: 'base-labels',
  TERRAIN_DEM: 'terrain-dem',
  WAYPOINTS_TASK: 'waypoints-task',
  WAYPOINTS_CATALOG: 'waypoints-catalog',
  TASK_LINES: 'task-lines',
  TASK_LABELS: 'task-labels',
  OBS_ZONES: 'obs-zones',
  AIRSPACE: 'airspace',
  OPENAIP: 'openaip-raster'
} as const;

export const MAP_LAYER = {
  BASE_IMAGERY: 'base-imagery',
  BASE_LABELS: 'base-labels',
  TERRAIN_HILLSHADE: 'terrain-hillshade',
  AIRSPACE_FILL: 'airspace-fill',
  AIRSPACE_LINE: 'airspace-line',
  OPENAIP_RASTER: 'openaip-raster',
  OBS_FILL: 'obs-zones-fill',
  OBS_LINE: 'obs-zones-line',
  TASK_LINES: 'task-lines',
  TASK_LABELS: 'task-labels',
  CATALOG_CLUSTER: 'catalog-cluster',
  CATALOG_CLUSTER_COUNT: 'catalog-cluster-count',
  CATALOG_DOT: 'catalog-dot',
  CATALOG_LABEL: 'catalog-label',
  TASK_DOT: 'task-dot',
  TASK_LABEL: 'task-label'
} as const;

export function getBasemapPreset(id: BasemapId): BasemapPreset {
  return BASEMAP_PRESETS.find(p => p.id === id) ?? BASEMAP_PRESETS[0];
}

export function isBasemapId(value: string): value is BasemapId {
  return BASEMAP_PRESETS.some(p => p.id === value);
}

function rasterSourceSpec(config: BasemapRasterConfig): {
  type: 'raster';
  tiles: string[];
  tileSize: number;
  maxzoom: number;
  attribution: string;
} {
  return {
    type: 'raster',
    tiles: config.tiles,
    tileSize: config.tileSize ?? 256,
    maxzoom: config.maxzoom ?? 19,
    attribution: config.attribution
  };
}

function terrainDemSourceSpec(): {
  type: 'raster-dem';
  url: string;
  tileSize: number;
  encoding: 'terrarium';
  attribution: string;
} {
  return {
    type: 'raster-dem',
    url: MAPTERHORN_DEM_TILEJSON_URL,
    tileSize: 512,
    encoding: 'terrarium',
    attribution:
      '<a href="https://mapterhorn.com/attribution" target="_blank" rel="noopener">© Mapterhorn</a>'
  };
}

export function buildBaseMapStyle(
  basemapId: BasemapId = DEFAULT_BASEMAP_ID,
  hillshadeVisible = false
): StyleSpecification {
  const preset = getBasemapPreset(basemapId);
  const sources: StyleSpecification['sources'] = {
    [MAP_SOURCE.BASE_IMAGERY]: rasterSourceSpec(preset.imagery),
    [MAP_SOURCE.TERRAIN_DEM]: terrainDemSourceSpec()
  };
  const layers: StyleSpecification['layers'] = [
    {
      id: MAP_LAYER.BASE_IMAGERY,
      type: 'raster',
      source: MAP_SOURCE.BASE_IMAGERY
    },
    {
      id: MAP_LAYER.TERRAIN_HILLSHADE,
      type: 'hillshade',
      source: MAP_SOURCE.TERRAIN_DEM,
      layout: { visibility: hillshadeVisible ? 'visible' : 'none' },
      paint: {
        'hillshade-method': 'igor',
        'hillshade-exaggeration': 0.35,
        'hillshade-highlight-color': 'rgb(255, 255, 228)',
        'hillshade-shadow-color': 'rgb(71, 59, 36)'
      }
    }
  ];

  if (preset.labels) {
    sources[MAP_SOURCE.BASE_LABELS] = rasterSourceSpec(preset.labels);
    layers.push({
      id: MAP_LAYER.BASE_LABELS,
      type: 'raster',
      source: MAP_SOURCE.BASE_LABELS,
      paint: { 'raster-opacity': preset.labels.opacity ?? 0.85 }
    });
  }

  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources,
    layers,
    terrain: {
      source: MAP_SOURCE.TERRAIN_DEM,
      exaggeration: 1
    }
  };
}

/** Affiche ou masque l’ombrage du relief (la source DEM reste active pour l’altitude au curseur). */
export function setTerrainHillshadeVisible(map: MaplibreMap, visible: boolean): void {
  if (!map.getLayer(MAP_LAYER.TERRAIN_HILLSHADE)) {
    return;
  }
  map.setLayoutProperty(
    MAP_LAYER.TERRAIN_HILLSHADE,
    'visibility',
    visible ? 'visible' : 'none'
  );
}

export function removeBasemapFromMap(map: MaplibreMap): void {
  if (map.getLayer(MAP_LAYER.BASE_LABELS)) {
    map.removeLayer(MAP_LAYER.BASE_LABELS);
  }
  if (map.getLayer(MAP_LAYER.BASE_IMAGERY)) {
    map.removeLayer(MAP_LAYER.BASE_IMAGERY);
  }
  if (map.getSource(MAP_SOURCE.BASE_LABELS)) {
    map.removeSource(MAP_SOURCE.BASE_LABELS);
  }
  if (map.getSource(MAP_SOURCE.BASE_IMAGERY)) {
    map.removeSource(MAP_SOURCE.BASE_IMAGERY);
  }
}

/** Insère le fond de carte sous les couches données (beforeLayerId = première couche overlay). */
export function applyBasemapToMap(
  map: MaplibreMap,
  basemapId: BasemapId,
  beforeLayerId: string
): void {
  removeBasemapFromMap(map);
  const preset = getBasemapPreset(basemapId);

  map.addSource(MAP_SOURCE.BASE_IMAGERY, rasterSourceSpec(preset.imagery));
  map.addLayer(
    {
      id: MAP_LAYER.BASE_IMAGERY,
      type: 'raster',
      source: MAP_SOURCE.BASE_IMAGERY
    },
    beforeLayerId
  );

  if (preset.labels) {
    map.addSource(MAP_SOURCE.BASE_LABELS, rasterSourceSpec(preset.labels));
    map.addLayer(
      {
        id: MAP_LAYER.BASE_LABELS,
        type: 'raster',
        source: MAP_SOURCE.BASE_LABELS,
        paint: { 'raster-opacity': preset.labels.opacity ?? 0.85 }
      },
      beforeLayerId
    );
  }

  reorderMapOverlayLayers(map);
}

/** Calques vecteur / symboles à garder au-dessus du fond (sous les labels Esri si présents). */
const LAYERS_ABOVE_BASE_IMAGERY: readonly string[] = [
  MAP_LAYER.TERRAIN_HILLSHADE,
  MAP_LAYER.OPENAIP_RASTER,
  MAP_LAYER.AIRSPACE_FILL,
  MAP_LAYER.AIRSPACE_LINE,
  MAP_LAYER.OBS_FILL,
  MAP_LAYER.OBS_LINE,
  MAP_LAYER.TASK_LINES,
  MAP_LAYER.TASK_LABELS
];

const LAYERS_ON_TOP: readonly string[] = [
  MAP_LAYER.CATALOG_CLUSTER,
  MAP_LAYER.CATALOG_CLUSTER_COUNT,
  MAP_LAYER.CATALOG_DOT,
  MAP_LAYER.CATALOG_LABEL,
  MAP_LAYER.TASK_DOT,
  MAP_LAYER.TASK_LABEL
];

/**
 * Ordre cible (bas → haut) : imagerie → données (circuit, zones) → labels raster → waypoints.
 * Ne place jamais les overlays sous BASE_IMAGERY (sinon masqués par les tuiles).
 */
export function reorderMapOverlayLayers(map: MaplibreMap): void {
  const hasLabels = map.getLayer(MAP_LAYER.BASE_LABELS) != null;

  if (hasLabels) {
    for (const layerId of LAYERS_ABOVE_BASE_IMAGERY) {
      if (map.getLayer(layerId)) {
        map.moveLayer(layerId, MAP_LAYER.BASE_LABELS);
      }
    }
  }

  for (const layerId of LAYERS_ON_TOP) {
    if (map.getLayer(layerId)) {
      map.moveLayer(layerId);
    }
  }
}

/** Bounds internes [south, west] / [north, east] → LngLatBoundsLike MapLibre. */
export function southWestNorthEastToLngLatBounds(
  bounds: [[number, number], [number, number]]
): [[number, number], [number, number]] {
  const [[south, west], [north, east]] = bounds;
  return [
    [west, south],
    [east, north]
  ];
}
