import type { StyleSpecification } from 'maplibre-gl';

export const SATELLITE_TILES = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution:
    'Imagerie &copy; <a href="https://www.esri.com/">Esri</a> — Esri, Maxar, Earthstar Geographics'
};

export const SATELLITE_LABELS = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  maxZoom: 19
};

/** Option E — LOD catalogue : cluster sous ce zoom, points individuels au-delà. */
export const CATALOG_CLUSTER_MAX_ZOOM = 10;

/** Pastilles catalogue visibles à partir de ce zoom (sous le seuil cluster). */
export const CATALOG_DOT_MIN_ZOOM = 8;

export const MAP_SOURCE = {
  ESRI_IMAGERY: 'esri-imagery',
  ESRI_LABELS: 'esri-labels',
  WAYPOINTS_TASK: 'waypoints-task',
  WAYPOINTS_CATALOG: 'waypoints-catalog',
  TASK_LINES: 'task-lines',
  TASK_LABELS: 'task-labels',
  OBS_ZONES: 'obs-zones',
  AIRSPACE: 'airspace',
  OPENAIP: 'openaip-raster'
} as const;

export const MAP_LAYER = {
  ESRI_IMAGERY: 'esri-imagery',
  ESRI_LABELS: 'esri-labels',
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
  TASK_BADGE: 'task-badge',
  TASK_LABEL: 'task-label'
} as const;

export function buildBaseMapStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      [MAP_SOURCE.ESRI_IMAGERY]: {
        type: 'raster',
        tiles: [SATELLITE_TILES.url],
        tileSize: 256,
        maxzoom: 19,
        attribution: SATELLITE_TILES.attribution
      },
      [MAP_SOURCE.ESRI_LABELS]: {
        type: 'raster',
        tiles: [SATELLITE_LABELS.url],
        tileSize: 256,
        maxzoom: SATELLITE_LABELS.maxZoom
      }
    },
    layers: [
      {
        id: MAP_LAYER.ESRI_IMAGERY,
        type: 'raster',
        source: MAP_SOURCE.ESRI_IMAGERY
      },
      {
        id: MAP_LAYER.ESRI_LABELS,
        type: 'raster',
        source: MAP_SOURCE.ESRI_LABELS,
        paint: { 'raster-opacity': 0.85 }
      }
    ]
  };
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
