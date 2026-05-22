import type { Feature, FeatureCollection, Geometry, Polygon } from 'geojson';
import type { PoaffProperties } from '../services/airspace-layer.service';
import { FL999_CEILING_M, flightLevelToMslM } from './airspace-altitude.util';
import type { AirspaceVolumeProperties } from './airspace-volume-enrich.util';
import {
  enrichAirspaceCollection,
  enrichAirspaceCollectionWithDem
} from './airspace-volume-enrich.util';
import type { Map as MaplibreMap } from 'maplibre-gl';

/** Relief fictif (m MSL) pour les zones AGL/GND sans DEM. */
export const AIRSPACE_DEBUG_MOCK_GROUND_M = 1800;

/** Centre de la grille de test (Aravis / Annecy — relief DEM disponible). */
export const AIRSPACE_DEBUG_GRID_CENTER: [number, number] = [6.865, 45.905];

const CELL_DEG = 0.034;
const HALF_DEG = 0.009;

export type AirspaceDebugScenarioCategory =
  | 'msl'
  | 'fl'
  | 'agl'
  | 'terrain'
  | 'flat'
  | 'excluded'
  | 'edge';

export interface AirspaceDebugScenario {
  id: string;
  titleKey: string;
  descriptionKey: string;
  expectedKey: string;
  category: AirspaceDebugScenarioCategory;
  feature: Feature<Geometry, PoaffProperties>;
  center: [number, number];
  camera: { pitch: number; bearing: number; zoom: number };
}

function cellCenter(col: number, row: number): [number, number] {
  return [
    AIRSPACE_DEBUG_GRID_CENTER[0] + col * CELL_DEG,
    AIRSPACE_DEBUG_GRID_CENTER[1] - row * CELL_DEG
  ];
}

function squarePolygon(center: [number, number], half = HALF_DEG): Polygon {
  const [lng, lat] = center;
  return {
    type: 'Polygon',
    coordinates: [
      [
        [lng - half, lat - half],
        [lng + half, lat - half],
        [lng + half, lat + half],
        [lng - half, lat + half],
        [lng - half, lat - half]
      ]
    ]
  };
}

function scenarioFeature(
  id: string,
  center: [number, number],
  props: PoaffProperties
): Feature<Geometry, PoaffProperties> {
  return {
    type: 'Feature',
    id,
    properties: {
      id,
      GUId: id,
      stroke: '#c026d3',
      'stroke-width': 2,
      fill: '#f0abfc',
      'fill-opacity': 0.45,
      ...props
    },
    geometry: squarePolygon(center)
  };
}

const DEFAULT_CAM = { pitch: 62, bearing: -28, zoom: 13.2 };

/**
 * Jeu de zones fictives pour valider le rendu 2D / fil de fer / plafonds MSL & AGL.
 * Disposées en grille autour de {@link AIRSPACE_DEBUG_GRID_CENTER}.
 */
export function buildAirspaceDebugScenarios(): AirspaceDebugScenario[] {
  const scenarios: Omit<AirspaceDebugScenario, 'camera'>[] = [
    {
      id: 'msl-fl-box',
      titleKey: 'airspaceDebug.scenarios.mslFlBox.title',
      descriptionKey: 'airspaceDebug.scenarios.mslFlBox.desc',
      expectedKey: 'airspaceDebug.scenarios.mslFlBox.expected',
      category: 'fl',
      center: cellCenter(0, 0),
      feature: scenarioFeature('msl-fl-box', cellCenter(0, 0), {
        nameV: 'DEBUG — CTR FL100→FL200',
        class: 'CTR',
        type: 'RESTRICTED',
        lower: 'FL100',
        upper: 'FL200',
        lowerM: flightLevelToMslM(100),
        upperM: flightLevelToMslM(200),
        stroke: '#7c3aed',
        fill: '#ddd6fe'
      })
    },
    {
      id: 'sfc-fl999',
      titleKey: 'airspaceDebug.scenarios.sfcFl999.title',
      descriptionKey: 'airspaceDebug.scenarios.sfcFl999.desc',
      expectedKey: 'airspaceDebug.scenarios.sfcFl999.expected',
      category: 'fl',
      center: cellCenter(1, 0),
      feature: scenarioFeature('sfc-fl999', cellCenter(1, 0), {
        nameV: 'DEBUG — SFC → FL999',
        class: 'CTR',
        type: 'RESTRICTED',
        lower: 'SFC',
        upper: 'FL999',
        lowerM: 0,
        upperM: Math.round(FL999_CEILING_M),
        stroke: '#ea580c',
        fill: '#fed7aa'
      })
    },
    {
      id: 'fl999-bad-upperm',
      titleKey: 'airspaceDebug.scenarios.fl999BadUpperM.title',
      descriptionKey: 'airspaceDebug.scenarios.fl999BadUpperM.desc',
      expectedKey: 'airspaceDebug.scenarios.fl999BadUpperM.expected',
      category: 'edge',
      center: cellCenter(2, 0),
      feature: scenarioFeature('fl999-bad-upperm', cellCenter(2, 0), {
        nameV: 'DEBUG — FL999 + upperM=999',
        class: 'CTR',
        type: 'RESTRICTED',
        lower: 'SFC',
        upper: 'FL999',
        lowerM: 0,
        upperM: 999,
        stroke: '#dc2626',
        fill: '#fecaca'
      })
    },
    {
      id: 'agl-gnd-top',
      titleKey: 'airspaceDebug.scenarios.aglGndTop.title',
      descriptionKey: 'airspaceDebug.scenarios.aglGndTop.desc',
      expectedKey: 'airspaceDebug.scenarios.aglGndTop.expected',
      category: 'agl',
      center: cellCenter(0, 1),
      feature: scenarioFeature('agl-gnd-top', cellCenter(0, 1), {
        nameV: 'DEBUG — GND → 2500FT AGL',
        class: 'RMZ',
        type: 'RESTRICTED',
        lower: 'GND',
        upper: '2500FT AGL',
        stroke: '#059669',
        fill: '#a7f3d0'
      })
    },
    {
      id: 'ft-amsl',
      titleKey: 'airspaceDebug.scenarios.ftAmsl.title',
      descriptionKey: 'airspaceDebug.scenarios.ftAmsl.desc',
      expectedKey: 'airspaceDebug.scenarios.ftAmsl.expected',
      category: 'msl',
      center: cellCenter(1, 1),
      feature: scenarioFeature('ft-amsl', cellCenter(1, 1), {
        nameV: 'DEBUG — 3000FT AMSL → 4500FT AMSL',
        class: 'TMA',
        type: 'RESTRICTED',
        lower: '3000FT AMSL',
        upper: '4500FT AMSL',
        stroke: '#2563eb',
        fill: '#bfdbfe'
      })
    },
    {
      id: 'msl-meters',
      titleKey: 'airspaceDebug.scenarios.mslMeters.title',
      descriptionKey: 'airspaceDebug.scenarios.mslMeters.desc',
      expectedKey: 'airspaceDebug.scenarios.mslMeters.expected',
      category: 'msl',
      center: cellCenter(2, 1),
      feature: scenarioFeature('msl-meters', cellCenter(2, 1), {
        nameV: 'DEBUG — 2000M → 3500M',
        class: 'CTR',
        type: 'PROHIBITED',
        lower: '2000M',
        upper: '3500M',
        lowerM: 2000,
        upperM: 3500,
        stroke: '#be123c',
        fill: '#fda4af'
      })
    },
    {
      id: 'unlimited',
      titleKey: 'airspaceDebug.scenarios.unlimited.title',
      descriptionKey: 'airspaceDebug.scenarios.unlimited.desc',
      expectedKey: 'airspaceDebug.scenarios.unlimited.expected',
      category: 'fl',
      center: cellCenter(0, 2),
      feature: scenarioFeature('unlimited', cellCenter(0, 2), {
        nameV: 'DEBUG — SFC → UNLIMITED',
        class: 'CTR',
        type: 'RESTRICTED',
        lower: 'SFC',
        upper: 'UNLIMITED',
        lowerM: 0,
        stroke: '#9333ea',
        fill: '#e9d5ff'
      })
    },
    {
      id: 'geo-local',
      titleKey: 'airspaceDebug.scenarios.geoLocal.title',
      descriptionKey: 'airspaceDebug.scenarios.geoLocal.desc',
      expectedKey: 'airspaceDebug.scenarios.geoLocal.expected',
      category: 'excluded',
      center: cellCenter(1, 2),
      feature: scenarioFeature('geo-local', cellCenter(1, 2), {
        nameV: 'DEBUG — GEO (petite emprise)',
        class: 'AREA',
        type: 'GEO',
        lower: 'SFC',
        upper: 'FL999',
        lowerM: 0,
        upperM: Math.round(FL999_CEILING_M),
        stroke: '#d97706',
        fill: '#fde68a'
      })
    },
    {
      id: 'flat-outline',
      titleKey: 'airspaceDebug.scenarios.flatOutline.title',
      descriptionKey: 'airspaceDebug.scenarios.flatOutline.desc',
      expectedKey: 'airspaceDebug.scenarios.flatOutline.expected',
      category: 'flat',
      center: cellCenter(2, 2),
      feature: scenarioFeature('flat-outline', cellCenter(2, 2), {
        nameV: 'DEBUG — contour 2D seul',
        class: 'OTHER',
        type: 'INFO',
        desc: 'Sans limites verticales exploitables',
        stroke: '#64748b',
        fill: '#e2e8f0'
      })
    },
    {
      id: 'large-area',
      titleKey: 'airspaceDebug.scenarios.largeArea.title',
      descriptionKey: 'airspaceDebug.scenarios.largeArea.desc',
      expectedKey: 'airspaceDebug.scenarios.largeArea.expected',
      category: 'excluded',
      center: [2.5, 46.5],
      feature: {
        type: 'Feature',
        id: 'large-area',
        properties: {
          id: 'large-area',
          GUId: 'large-area',
          nameV: 'DEBUG — AREA > 350 km (pas de volume 3D)',
          class: 'AREA',
          type: 'RESTRICTED',
          lower: 'SFC',
          upper: 'FL095',
          lowerM: 0,
          upperM: flightLevelToMslM(95),
          stroke: '#0d9488',
          fill: '#99f6e4'
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-5, 42],
              [9, 42],
              [9, 51],
              [-5, 51],
              [-5, 42]
            ]
          ]
        }
      }
    }
  ];

  return scenarios.map(s => ({
    ...s,
    camera: { ...DEFAULT_CAM }
  }));
}

export function buildAirspaceDebugFeatureCollection(
  scenarios: readonly AirspaceDebugScenario[] = buildAirspaceDebugScenarios()
): FeatureCollection<Geometry, PoaffProperties> {
  return {
    type: 'FeatureCollection',
    features: scenarios.map(s => s.feature)
  };
}

export function buildAirspaceDebugSubsetCollection(
  scenarioIds: readonly string[],
  scenarios: readonly AirspaceDebugScenario[] = buildAirspaceDebugScenarios()
): FeatureCollection<Geometry, PoaffProperties> {
  const set = new Set(scenarioIds);
  const subset = scenarios.filter(s => set.has(s.id));
  return buildAirspaceDebugFeatureCollection(subset);
}

function shiftLngLat(
  lng: number,
  lat: number,
  dLng: number,
  dLat: number
): [number, number] {
  return [lng + dLng, lat + dLat];
}

function shiftGeometry(geometry: Geometry, dLng: number, dLat: number): Geometry {
  if (geometry.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geometry.coordinates.map(ring =>
        ring.map(([lng, lat]) => shiftLngLat(lng, lat, dLng, dLat))
      )
    };
  }
  if (geometry.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geometry.coordinates.map(poly =>
        poly.map(ring => ring.map(([lng, lat]) => shiftLngLat(lng, lat, dLng, dLat)))
      )
    };
  }
  return geometry;
}

/**
 * Déplace toutes les zones de test pour ancrer la grille sur un nouveau centre
 * (conserve la disposition relative des scénarios).
 */
export function relocateAirspaceDebugScenarios(
  scenarios: readonly AirspaceDebugScenario[],
  fromAnchor: [number, number],
  toAnchor: [number, number]
): AirspaceDebugScenario[] {
  const dLng = toAnchor[0] - fromAnchor[0];
  const dLat = toAnchor[1] - fromAnchor[1];
  if (dLng === 0 && dLat === 0) return [...scenarios];

  return scenarios.map(s => {
    const center: [number, number] = [
      s.center[0] + dLng,
      s.center[1] + dLat
    ];
    return {
      ...s,
      center,
      feature: {
        ...s.feature,
        geometry: shiftGeometry(s.feature.geometry, dLng, dLat)
      }
    };
  });
}

export function enrichAirspaceDebugCollection(
  map: MaplibreMap | null,
  collection: FeatureCollection<Geometry, PoaffProperties>,
  options: { useDemGround: boolean; mockGroundM?: number }
): Promise<FeatureCollection<Geometry, AirspaceVolumeProperties>> {
  if (options.useDemGround && map) {
    return enrichAirspaceCollectionWithDem(map, collection, { chunkSize: 40 });
  }
  const groundM = options.mockGroundM ?? AIRSPACE_DEBUG_MOCK_GROUND_M;
  const groundById = new Map<string, number>();
  for (const f of collection.features) {
    const key = String(f.properties?.id ?? f.properties?.GUId ?? '');
    if (key) groundById.set(key, groundM);
  }
  return Promise.resolve(enrichAirspaceCollection(collection, groundById));
}

/** Bbox [[west,south],[east,north]] pour fitBounds. */
export function scenarioLngLatBounds(
  scenario: AirspaceDebugScenario
): [[number, number], [number, number]] {
  const geom = scenario.feature.geometry;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  const visit = (lng: number, lat: number): void => {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  };

  if (geom.type === 'Polygon') {
    for (const ring of geom.coordinates) {
      for (const [lng, lat] of ring) visit(lng, lat);
    }
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) {
      for (const ring of poly) {
        for (const [lng, lat] of ring) visit(lng, lat);
      }
    }
  } else {
    visit(scenario.center[0], scenario.center[1]);
  }

  if (!Number.isFinite(minLng)) {
    const [lng, lat] = scenario.center;
    const pad = 0.02;
    return [
      [lng - pad, lat - pad],
      [lng + pad, lat + pad]
    ];
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat]
  ];
}
