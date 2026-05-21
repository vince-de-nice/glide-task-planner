import { ObservationZoneConfig } from '../models/observation-zone.model';
import {
  bearingDegrees,
  cupFixedAxisBearingDeg,
  cupZoneReferenceBearingDeg,
  ObsZoneLegContext
} from './obs-zone-map.util';

export type CupStyleValue = 0 | 1 | 2 | 3 | 4;

export type CupStyleRefKind = 'north' | 'prev' | 'next' | 'departure' | 'current';

export interface CupStyleRefMarker {
  kind: CupStyleRefKind;
  /** Position sur le schéma (° horaire depuis le nord, pour placement SVG). */
  bearingDeg: number;
  available: boolean;
  /** Nom du waypoint affiché (tronqué côté UI si besoin). */
  name?: string;
}

export interface CupStyleOrientationPreview {
  style: CupStyleValue;
  /** Axe d’orientation affiché (° vrai, horaire depuis le nord). */
  axisBearingDeg: number;
  axisAvailable: boolean;
  markers: CupStyleRefMarker[];
  /** Clé i18n décrivant les repères pris en compte. */
  referenceKey: string;
  referenceParams: Record<string, string | number>;
}

const CX = 50;
const CY = 50;
const REF_RADIUS = 32;
const AXIS_LEN = 36;

/** Point SVG depuis un cap (° vrai, horaire depuis le nord). */
export function cupStylePolarToSvg(bearingDeg: number, radius: number): { x: number; y: number } {
  const rad = (bearingDeg * Math.PI) / 180;
  return {
    x: CX + radius * Math.sin(rad),
    y: CY - radius * Math.cos(rad)
  };
}

export function cupStyleAxisLine(axisBearingDeg: number): { x1: number; y1: number; x2: number; y2: number } {
  const end = cupStylePolarToSvg(axisBearingDeg, AXIS_LEN);
  return { x1: CX, y1: CY, x2: end.x, y2: end.y };
}

function truncateName(name: string, max = 10): string {
  const t = name.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/** Cap depuis le point courant vers un autre waypoint (position sur le schéma). */
function markerToward(
  kind: CupStyleRefKind,
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  name?: string
): CupStyleRefMarker {
  return {
    kind,
    bearingDeg: bearingDegrees(from.latitude, from.longitude, to.latitude, to.longitude),
    available: true,
    name: name ? truncateName(name) : undefined
  };
}

function zoneForStyle(
  base: ObservationZoneConfig,
  style: CupStyleValue
): ObservationZoneConfig {
  return { ...base, cupStyle: style };
}

export function buildCupStyleOrientationPreview(
  style: CupStyleValue,
  ctx: ObsZoneLegContext | null,
  baseZone: ObservationZoneConfig
): CupStyleOrientationPreview {
  const zone = zoneForStyle(baseZone, style);
  const wp = ctx?.waypoint;
  const prev = ctx?.prev ?? null;
  const next = ctx?.next ?? null;
  const departure = ctx?.departure ?? null;

  const axisBearingDeg = ctx ? cupZoneReferenceBearingDeg(zone, ctx) : cupFixedAxisBearingDeg(zone.a12Deg);
  const axisAvailable =
    style === 0
      ? zone.a12Deg != null && Number.isFinite(zone.a12Deg)
      : style === 1
        ? Boolean(prev && next)
        : style === 2
          ? Boolean(next)
          : style === 3
            ? Boolean(prev)
            : style === 4
              ? Boolean(departure)
              : true;

  const markers: CupStyleRefMarker[] = [
    { kind: 'north', bearingDeg: 0, available: true, name: 'N' },
    { kind: 'current', bearingDeg: 0, available: Boolean(wp), name: wp ? truncateName(wp.name, 8) : undefined }
  ];

  let referenceKey = 'zoneCup.styleOrientation.ref0';
  const referenceParams: Record<string, string | number> = {
    bearing: Math.round(axisBearingDeg)
  };

  switch (style) {
    case 0: {
      if (zone.a12Deg != null && Number.isFinite(zone.a12Deg)) {
        referenceParams['a12'] = Math.round(zone.a12Deg);
        referenceKey = 'zoneCup.styleOrientation.ref0a12';
      } else {
        referenceKey = 'zoneCup.styleOrientation.ref0north';
      }
      break;
    }
    case 1: {
      if (wp && prev) {
        markers.push(markerToward('prev', wp, prev, prev.name));
      } else {
        markers.push({ kind: 'prev', bearingDeg: 270, available: false });
      }
      if (wp && next) {
        markers.push(markerToward('next', wp, next, next.name));
      } else {
        markers.push({ kind: 'next', bearingDeg: 90, available: false });
      }
      referenceKey =
        prev && next
          ? 'zoneCup.styleOrientation.ref1'
          : 'zoneCup.styleOrientation.ref1missing';
      if (prev) referenceParams['prev'] = truncateName(prev.name);
      if (next) referenceParams['next'] = truncateName(next.name);
      break;
    }
    case 2: {
      if (wp && next) {
        markers.push(markerToward('next', wp, next, next.name));
        referenceParams['next'] = truncateName(next.name);
        referenceKey = 'zoneCup.styleOrientation.ref2';
      } else {
        markers.push({ kind: 'next', bearingDeg: 90, available: false });
        referenceKey = 'zoneCup.styleOrientation.ref2missing';
      }
      break;
    }
    case 3: {
      if (wp && prev) {
        markers.push(markerToward('prev', wp, prev, prev.name));
        referenceParams['prev'] = truncateName(prev.name);
        referenceKey = 'zoneCup.styleOrientation.ref3';
      } else {
        markers.push({ kind: 'prev', bearingDeg: 270, available: false });
        referenceKey = 'zoneCup.styleOrientation.ref3missing';
      }
      break;
    }
    case 4: {
      if (wp && departure) {
        markers.push(markerToward('departure', wp, departure, departure.name));
        referenceParams['dep'] = truncateName(departure.name);
        referenceKey = 'zoneCup.styleOrientation.ref4';
      } else {
        markers.push({ kind: 'departure', bearingDeg: 180, available: false });
        referenceKey = 'zoneCup.styleOrientation.ref4missing';
      }
      break;
    }
  }

  return {
    style,
    axisBearingDeg,
    axisAvailable,
    markers,
    referenceKey,
    referenceParams
  };
}

export const CUP_STYLE_ORIENTATION_VIEWBOX = '0 0 100 100';
export const CUP_STYLE_ORIENTATION_CENTER = { cx: CX, cy: CY };
