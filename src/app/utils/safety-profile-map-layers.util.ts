import type { Map as MaplibreMap } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { geoJsonFlagEq } from './map-expression.util';
import {
  MAP_TEXT_FONT_BOLD,
  MAP_TEXT_FONT_REGULAR
} from '../components/map-view/map-style.constants';
import { SAFETY_PROFILE_SEMANTIC } from './safety-profile-palette.util';
import {
  createSafetyConeCustomLayer,
  SAFETY_CONES_CUSTOM_LAYER_ID,
  type SafetyConeThreeCustomLayer
} from './safety-cone-three-layer.util';
import {
  createSafetyMinAltitudeCustomLayer,
  SAFETY_MIN_ALTITUDE_LAYER_ID,
  type SafetyMinAltitudeThreeCustomLayer
} from './safety-min-altitude-three-layer.util';

export const SAFETY_PROFILE_EMPTY_FC: FeatureCollection = {
  type: 'FeatureCollection',
  features: []
};

/** Sources GeoJSON carte profil sécurité. */
export const PROFILE_MAP_SOURCE = {
  BRANCHES: 'safety-profile-branches',
  POINTS: 'safety-profile-points',
  LANDABLE_HIGHLIGHT: 'safety-profile-landable-highlight',
  CURSOR: 'safety-profile-cursor',
  CURSOR_TRACK: 'safety-profile-cursor-track',
  AIRSPACE_HOVER_FILL: 'safety-profile-airspace-hover-fill',
  AIRSPACE_HOVER_LINE: 'safety-profile-airspace-hover-line'
} as const;

export const PROFILE_MAP_LAYER = {
  BRANCHES: 'safety-profile-branches',
  BRANCHES_HIT: 'safety-profile-branches-hit',
  POINTS: 'safety-profile-points',
  POINT_LABELS: 'safety-profile-point-labels',
  LANDABLE_HIGHLIGHT_RING: 'safety-profile-landable-highlight-ring',
  LANDABLE_HIGHLIGHT: 'safety-profile-landable-highlight',
  LANDABLE_HIGHLIGHT_LABEL: 'safety-profile-landable-highlight-label',
  CURSOR_TRACK: 'safety-profile-cursor-track',
  CURSOR_POINT: 'safety-profile-cursor-point',
  AIRSPACE_HOVER_FILL: 'safety-profile-airspace-hover-fill',
  AIRSPACE_HOVER_LINE: 'safety-profile-airspace-hover-line'
} as const;

/** Ordre de superposition des calques métier (bas → haut). */
export const PROFILE_LAYER_STACK: readonly string[] = [
  SAFETY_CONES_CUSTOM_LAYER_ID,
  SAFETY_MIN_ALTITUDE_LAYER_ID,
  PROFILE_MAP_LAYER.BRANCHES_HIT,
  PROFILE_MAP_LAYER.BRANCHES,
  PROFILE_MAP_LAYER.POINTS,
  PROFILE_MAP_LAYER.POINT_LABELS,
  PROFILE_MAP_LAYER.LANDABLE_HIGHLIGHT_RING,
  PROFILE_MAP_LAYER.LANDABLE_HIGHLIGHT,
  PROFILE_MAP_LAYER.LANDABLE_HIGHLIGHT_LABEL,
  PROFILE_MAP_LAYER.CURSOR_TRACK,
  PROFILE_MAP_LAYER.CURSOR_POINT,
  PROFILE_MAP_LAYER.AIRSPACE_HOVER_FILL,
  PROFILE_MAP_LAYER.AIRSPACE_HOVER_LINE
];

export interface SafetyProfileMapLayers {
  safetyConesLayer: SafetyConeThreeCustomLayer;
  safetyMinAltitudeLayer: SafetyMinAltitudeThreeCustomLayer;
}

export function installSafetyProfileMapLayers(map: MaplibreMap): SafetyProfileMapLayers {
  const empty = SAFETY_PROFILE_EMPTY_FC;

  const safetyConesLayer = createSafetyConeCustomLayer();
  map.addLayer(safetyConesLayer);
  const safetyMinAltitudeLayer = createSafetyMinAltitudeCustomLayer();
  map.addLayer(safetyMinAltitudeLayer);

  map.addSource(PROFILE_MAP_SOURCE.POINTS, { type: 'geojson', data: empty });
  map.addLayer({
    id: PROFILE_MAP_LAYER.POINTS,
    type: 'circle',
    source: PROFILE_MAP_SOURCE.POINTS,
    paint: {
      'circle-radius': [
        'match',
        ['get', 'role'],
        'from',
        10,
        'to',
        10,
        'landable',
        12,
        8
      ],
      'circle-color': ['get', 'color'],
      'circle-stroke-width': 2.5,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 1
    }
  });
  map.addLayer({
    id: PROFILE_MAP_LAYER.POINT_LABELS,
    type: 'symbol',
    source: PROFILE_MAP_SOURCE.POINTS,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': [...MAP_TEXT_FONT_REGULAR],
      'text-size': 11,
      'text-offset': [0, 1.35],
      'text-anchor': 'top',
      'text-max-width': 10,
      'text-optional': true
    },
    paint: {
      'text-color': ['get', 'color'],
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.75
    }
  });

  map.addSource(PROFILE_MAP_SOURCE.BRANCHES, { type: 'geojson', data: empty });
  map.addLayer({
    id: PROFILE_MAP_LAYER.BRANCHES_HIT,
    type: 'line',
    source: PROFILE_MAP_SOURCE.BRANCHES,
    paint: { 'line-width': 14, 'line-opacity': 0 }
  });
  map.addLayer({
    id: PROFILE_MAP_LAYER.BRANCHES,
    type: 'line',
    source: PROFILE_MAP_SOURCE.BRANCHES,
    paint: {
      'line-color': [
        'case',
        geoJsonFlagEq('selected'),
        SAFETY_PROFILE_SEMANTIC.legRouteActive,
        SAFETY_PROFILE_SEMANTIC.legRouteInactive
      ],
      'line-width': ['case', geoJsonFlagEq('selected'), 6, 3],
      'line-opacity': ['case', geoJsonFlagEq('selected'), 1, 0.55]
    }
  });

  map.addSource(PROFILE_MAP_SOURCE.LANDABLE_HIGHLIGHT, { type: 'geojson', data: empty });
  map.addLayer({
    id: PROFILE_MAP_LAYER.LANDABLE_HIGHLIGHT_RING,
    type: 'circle',
    source: PROFILE_MAP_SOURCE.LANDABLE_HIGHLIGHT,
    paint: {
      'circle-radius': 22,
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.28,
      'circle-stroke-width': 0
    }
  });
  map.addLayer({
    id: PROFILE_MAP_LAYER.LANDABLE_HIGHLIGHT,
    type: 'circle',
    source: PROFILE_MAP_SOURCE.LANDABLE_HIGHLIGHT,
    paint: {
      'circle-radius': 12,
      'circle-color': ['get', 'color'],
      'circle-stroke-width': 3.5,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 1
    }
  });
  map.addLayer({
    id: PROFILE_MAP_LAYER.LANDABLE_HIGHLIGHT_LABEL,
    type: 'symbol',
    source: PROFILE_MAP_SOURCE.LANDABLE_HIGHLIGHT,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': [...MAP_TEXT_FONT_BOLD],
      'text-size': 13,
      'text-offset': [0, 1.6],
      'text-anchor': 'top',
      'text-max-width': 12,
      'text-optional': true
    },
    paint: {
      'text-color': ['get', 'color'],
      'text-halo-color': '#ffffff',
      'text-halo-width': 2.25
    }
  });

  map.addSource(PROFILE_MAP_SOURCE.AIRSPACE_HOVER_FILL, { type: 'geojson', data: empty });
  map.addLayer({
    id: PROFILE_MAP_LAYER.AIRSPACE_HOVER_FILL,
    type: 'fill',
    source: PROFILE_MAP_SOURCE.AIRSPACE_HOVER_FILL,
    paint: {
      'fill-color': '#f59e0b',
      'fill-opacity': 0.38,
      'fill-outline-color': '#b45309'
    }
  });
  map.addSource(PROFILE_MAP_SOURCE.AIRSPACE_HOVER_LINE, { type: 'geojson', data: empty });
  map.addLayer({
    id: PROFILE_MAP_LAYER.AIRSPACE_HOVER_LINE,
    type: 'line',
    source: PROFILE_MAP_SOURCE.AIRSPACE_HOVER_LINE,
    paint: {
      'line-color': '#b45309',
      'line-width': 3,
      'line-opacity': 0.95
    }
  });

  map.addSource(PROFILE_MAP_SOURCE.CURSOR_TRACK, { type: 'geojson', data: empty });
  map.addSource(PROFILE_MAP_SOURCE.CURSOR, { type: 'geojson', data: empty });
  map.addLayer({
    id: PROFILE_MAP_LAYER.CURSOR_TRACK,
    type: 'line',
    source: PROFILE_MAP_SOURCE.CURSOR_TRACK,
    paint: {
      'line-color': SAFETY_PROFILE_SEMANTIC.profileCrosshair,
      'line-width': 5,
      'line-opacity': 0.9
    }
  });
  map.addLayer({
    id: PROFILE_MAP_LAYER.CURSOR_POINT,
    type: 'circle',
    source: PROFILE_MAP_SOURCE.CURSOR,
    paint: {
      'circle-radius': 9,
      'circle-color': '#ffffff',
      'circle-stroke-width': 3,
      'circle-stroke-color': SAFETY_PROFILE_SEMANTIC.profileCrosshair,
      'circle-opacity': 1
    }
  });

  return { safetyConesLayer, safetyMinAltitudeLayer };
}

export function repositionProfileMapLayers(map: MaplibreMap): void {
  for (const layerId of PROFILE_LAYER_STACK) {
    if (map.getLayer(layerId)) {
      map.moveLayer(layerId);
    }
  }
}
