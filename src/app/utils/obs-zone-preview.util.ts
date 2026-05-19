import { CircuitLegRole } from '../models/circuit.model';
import {
  ObservationZoneConfig,
  normalizeObservationZone
} from '../models/observation-zone.model';
import {
  ObsZoneLegContext,
  ObsZoneMapShape,
  ObsZoneMapShapeKind,
  bearingDegrees,
  buildObsZoneMapShapes,
  cupZoneReferenceBearingDeg
} from './obs-zone-map.util';

/** ViewBox normalisé pour les miniatures de liste. */
export const OBS_ZONE_PREVIEW_VIEWBOX = '0 0 48 32';

const CX = 24;
const CY = 16;
const MAX_R = 14;

export interface ObsZonePreviewLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ObsZonePreviewView {
  kind: ObsZoneMapShapeKind;
  pathD?: string;
  circleR?: number;
  /** Ligne de gate (départ / arrivée). */
  line?: ObsZonePreviewLine;
  /** Traits d’orientation (0° = nord / haut de l’icône). */
  markers?: ObsZonePreviewLine[];
  role: CircuitLegRole;
  label: string;
}

function polar(bearingDeg: number, radius = MAX_R): [number, number] {
  const rad = (bearingDeg * Math.PI) / 180;
  return [CX + radius * Math.sin(rad), CY - radius * Math.cos(rad)];
}

function segment(bearingDeg: number, length = MAX_R): ObsZonePreviewLine {
  const [x2, y2] = polar(bearingDeg, length);
  return { x1: CX, y1: CY, x2, y2 };
}

function sectorPathD(
  startBearingDeg: number,
  endBearingDeg: number,
  outerR = MAX_R,
  innerR = 0
): string {
  let start = startBearingDeg;
  let end = endBearingDeg;
  while (end <= start) {
    end += 360;
  }
  const sweep = end - start;
  const large = sweep > 180 ? 1 : 0;
  const [x0, y0] = polar(start, outerR);
  const [x1, y1] = polar(end, outerR);

  if (innerR <= 0) {
    return `M ${CX} ${CY} L ${x0} ${y0} A ${outerR} ${outerR} 0 ${large} 1 ${x1} ${y1} Z`;
  }

  const [xi0, yi0] = polar(end, innerR);
  const [xi1, yi1] = polar(start, innerR);
  return [
    `M ${x0} ${y0}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${x1} ${y1}`,
    `L ${xi0} ${yi0}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${xi1} ${yi1}`,
    'Z'
  ].join(' ');
}

function lineSegmentFromShape(shape: ObsZoneMapShape): ObsZonePreviewLine {
  if (shape.linePoints && shape.linePoints.length >= 2) {
    const [p0, p1] = shape.linePoints;
    const brg = bearingDegrees(p0[0], p0[1], p1[0], p1[1]);
    const halfLen = 13;
    const [x1, y1] = polar(brg + 180, halfLen);
    const [x2, y2] = polar(brg, halfLen);
    return { x1, y1, x2, y2 };
  }
  return segment(90, 13);
}

function orientationMarkers(
  zone: ObservationZoneConfig,
  ctx: ObsZoneLegContext,
  shape: ObsZoneMapShape
): ObsZonePreviewLine[] {
  if (shape.kind === 'sector' || shape.kind === 'ring-sector' || shape.kind === 'line') {
    return [];
  }

  const wp = ctx.waypoint;
  const markers: ObsZonePreviewLine[] = [];

  switch (zone.cupStyle) {
    case 0:
      markers.push(segment(0, MAX_R - 2));
      break;
    case 1:
      if (ctx.next) {
        markers.push(
          segment(
            bearingDegrees(wp.latitude, wp.longitude, ctx.next.latitude, ctx.next.longitude),
            MAX_R - 2
          )
        );
      }
      if (ctx.prev) {
        markers.push(
          segment(
            bearingDegrees(ctx.prev.latitude, ctx.prev.longitude, wp.latitude, wp.longitude),
            MAX_R - 2
          )
        );
      }
      break;
    case 2:
      if (ctx.next) {
        markers.push(
          segment(
            bearingDegrees(wp.latitude, wp.longitude, ctx.next.latitude, ctx.next.longitude),
            MAX_R - 2
          )
        );
      }
      break;
    case 3:
      if (ctx.prev) {
        markers.push(
          segment(
            bearingDegrees(ctx.prev.latitude, ctx.prev.longitude, wp.latitude, wp.longitude),
            MAX_R - 2
          )
        );
      }
      break;
    case 4:
      if (ctx.departure) {
        markers.push(
          segment(
            bearingDegrees(
              wp.latitude,
              wp.longitude,
              ctx.departure.latitude,
              ctx.departure.longitude
            ),
            MAX_R - 2
          )
        );
      }
      break;
    default:
      markers.push(segment(cupZoneReferenceBearingDeg(zone, ctx), MAX_R - 2));
  }

  return markers;
}

function mapShapeToPreview(
  shape: ObsZoneMapShape,
  zone: ObservationZoneConfig,
  ctx: ObsZoneLegContext
): ObsZonePreviewView {
  const base: ObsZonePreviewView = {
    kind: shape.kind,
    role: shape.role,
    label: shape.label
  };

  switch (shape.kind) {
    case 'circle':
      return {
        ...base,
        circleR: MAX_R,
        markers: orientationMarkers(zone, ctx, shape)
      };

    case 'sector':
      return {
        ...base,
        pathD: sectorPathD(shape.startBearingDeg ?? 0, shape.endBearingDeg ?? 360)
      };

    case 'ring-sector': {
      const outer = shape.radiusM ?? MAX_R;
      const inner = shape.innerRadiusM ?? outer * 0.35;
      const innerNorm = Math.max(3, (inner / outer) * MAX_R);
      return {
        ...base,
        pathD: sectorPathD(
          shape.startBearingDeg ?? 0,
          shape.endBearingDeg ?? 360,
          MAX_R,
          innerNorm
        )
      };
    }

    case 'line':
      return {
        ...base,
        line: lineSegmentFromShape(shape)
      };

    default:
      return { ...base, circleR: MAX_R };
  }
}

export function buildObsZonePreview(ctx: ObsZoneLegContext): ObsZonePreviewView | null {
  const shapes = buildObsZoneMapShapes(ctx);
  if (shapes.length === 0) {
    return null;
  }
  const zone = normalizeObservationZone(
    ctx.leg.obsZone,
    ctx.leg.role,
    ctx.defaultRadiusM
  );
  return mapShapeToPreview(shapes[0], zone, ctx);
}
