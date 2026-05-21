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

/** Libellés waypoint visibles à partir de ce zoom (MapLibre minzoom sur la couche texte). */
export const MIN_ZOOM_FOR_LABELS = 11;

export const MAP_SOURCE = {
  ESRI_IMAGERY: 'esri-imagery',
  ESRI_LABELS: 'esri-labels',
  WAYPOINTS: 'waypoints',
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
  WAYPOINTS_DOT: 'waypoints-dot',
  WAYPOINTS_LABEL: 'waypoints-label'
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
