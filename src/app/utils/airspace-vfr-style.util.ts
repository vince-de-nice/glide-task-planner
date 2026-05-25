import type { ExpressionSpecification } from 'maplibre-gl';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { PoaffProperties } from '../services/airspace-layer.service';
import type { AirspaceVolumeProperties } from './airspace-volume-enrich.util';

/** Familles de symbologie carte VFR (réf. docs/carte-vfr-references-styles-zones.md). */
export type AirspaceVfrFamily =
  | 'controlled'
  | 'restricted'
  | 'prohibited'
  | 'protect'
  | 'zsm'
  | 'ffvl'
  | 'other';

export interface AirspaceVfrPaletteEntry {
  stroke: string;
  fill: string;
  fillOpacity: number;
  strokeWidth: number;
}

export interface AirspaceVfrResolvedPaint extends AirspaceVfrPaletteEntry {
  family: AirspaceVfrFamily;
}

/** Propriétés GeoJSON ajoutées pour le rendu MapLibre. */
export interface AirspaceVfrStyleProps {
  vfrStroke: string;
  vfrFill: string;
  vfrFillOpacity: number;
  vfrStrokeWidth: number;
  vfrFamily: AirspaceVfrFamily;
}

const CONTROLLED_TYPES = new Set([
  'TMA',
  'CTA',
  'CTR',
  'LTA',
  'TMZ'
]);

const RESTRICTED_TYPES = new Set(['R', 'RTBA', 'CBA', 'RMZ']);

const PALETTE: Record<AirspaceVfrFamily, AirspaceVfrPaletteEntry> = {
  controlled: {
    stroke: '#1e40af',
    fill: '#93c5fd',
    fillOpacity: 0.22,
    strokeWidth: 2.5
  },
  restricted: {
    stroke: '#dc2626',
    fill: '#fecaca',
    fillOpacity: 0.28,
    strokeWidth: 2.25
  },
  prohibited: {
    stroke: '#b91c1c',
    fill: '#fca5a5',
    fillOpacity: 0.3,
    strokeWidth: 2.25
  },
  protect: {
    stroke: '#c2410c',
    fill: '#fed7aa',
    fillOpacity: 0.18,
    strokeWidth: 1.75
  },
  zsm: {
    stroke: '#1d4ed8',
    fill: '#dbeafe',
    fillOpacity: 0.15,
    strokeWidth: 1.5
  },
  ffvl: {
    stroke: '#15803d',
    fill: '#bbf7d0',
    fillOpacity: 0.18,
    strokeWidth: 1.5
  },
  other: {
    stroke: '#6b7280',
    fill: '#e5e7eb',
    fillOpacity: 0.12,
    strokeWidth: 1.5
  }
};

export function resolveAirspaceVfrFamily(
  props: Pick<PoaffProperties, 'class' | 'type'> | undefined
): AirspaceVfrFamily {
  const cls = (props?.class ?? '').trim().toUpperCase();
  const typ = (props?.type ?? '').trim().toUpperCase();

  if (cls === 'FFVL' || cls === 'FFVP') return 'ffvl';
  if (cls === 'ZSM') return 'zsm';
  if (cls === 'GP' || typ === 'PROTECT') return 'protect';
  if (cls === 'P') return 'prohibited';
  if (cls === 'R' || RESTRICTED_TYPES.has(typ)) return 'restricted';
  if (cls === 'C' || (cls === 'D' && CONTROLLED_TYPES.has(typ))) {
    return 'controlled';
  }
  if (cls === 'D') return 'restricted';
  return 'other';
}

export function resolveAirspaceVfrPaint(
  props: PoaffProperties | undefined
): AirspaceVfrResolvedPaint {
  const family = resolveAirspaceVfrFamily(props);
  return { family, ...PALETTE[family] };
}

export function vfrStylePropsFromPoaff(
  props: PoaffProperties | undefined
): AirspaceVfrStyleProps {
  const paint = resolveAirspaceVfrPaint(props);
  return {
    vfrStroke: paint.stroke,
    vfrFill: paint.fill,
    vfrFillOpacity: paint.fillOpacity,
    vfrStrokeWidth: paint.strokeWidth,
    vfrFamily: paint.family
  };
}

export function wireframeColorFromProps(props: PoaffProperties | undefined): string {
  return resolveAirspaceVfrPaint(props).stroke;
}

export type AirspaceFeatureProperties = AirspaceVolumeProperties &
  AirspaceVfrStyleProps;

/** Attache vfrStroke / vfrFill / … à chaque feature avant affichage carte. */
export function enrichAirspaceCollectionVfrStyles<
  G extends Geometry = Geometry
>(
  collection: FeatureCollection<G, AirspaceVolumeProperties>
): FeatureCollection<G, AirspaceFeatureProperties> {
  return {
    type: 'FeatureCollection',
    features: collection.features.map(f => ({
      ...f,
      properties: {
        ...(f.properties ?? {}),
        ...vfrStylePropsFromPoaff(f.properties)
      } as AirspaceFeatureProperties
    }))
  };
}

/** Largeur de trait × épaisseur VFR selon le zoom. */
export function airspaceVfrLineWidthExpression(): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    8,
    ['*', 0.6, ['get', 'vfrStrokeWidth']],
    12,
    ['*', 0.9, ['get', 'vfrStrokeWidth']],
    16,
    ['get', 'vfrStrokeWidth']
  ];
}

export function airspaceVfrHaloWidthExpression(): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    8,
    ['*', 1.35, ['get', 'vfrStrokeWidth']],
    12,
    ['*', 1.65, ['get', 'vfrStrokeWidth']],
    16,
    ['*', 1.85, ['get', 'vfrStrokeWidth']]
  ];
}

export function airspaceVfrLineDashExpression(): ExpressionSpecification {
  return [
    'case',
    [
      '==',
      ['upcase', ['coalesce', ['get', 'activationCode'], '']],
      'H24'
    ],
    ['literal', [1, 0]],
    [
      'in',
      ['upcase', ['coalesce', ['get', 'activationCode'], '']],
      ['literal', ['HX', 'TIMSH']]
    ],
    ['literal', [8, 5]],
    ['literal', [2, 4]]
  ] as ExpressionSpecification;
}
