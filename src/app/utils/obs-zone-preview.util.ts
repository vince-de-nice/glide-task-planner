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
  cupZoneReferenceBearingDeg,
  hasFaiInnerSector
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
  /** Tracés SVG (keyhole FAI = un seul contour). */
  pathDs?: string[];
  /** Premier tracé (compatibilité). */
  pathD?: string;
  circleR?: number;
  line?: ObsZonePreviewLine;
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
  const start = startBearingDeg;
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
  if (
    shape.kind === 'sector' ||
    shape.kind === 'ring-sector' ||
    shape.kind === 'fai-keyhole' ||
    shape.kind === 'line'
  ) {
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

function previewInnerRadiusM(outerM: number, innerM: number): number {
  return Math.max(3, (innerM / outerM) * MAX_R);
}

function pt(bearingDeg: number, radius: number): string {
  const [x, y] = polar(bearingDeg, radius);
  return `${x} ${y}`;
}

/**
 * Contour unique keyhole FAI = union(secteur 0→R2/A2, anneau R2→R1/A1).
 *
 * Périmètre (7 segments), sens horaire :
 *   1. Centre → (bA2L, R2)          ligne radiale gauche du secteur intérieur
 *   2. Arc sur R2 : bA2L → bA1L     encoche gauche
 *   3. (bA1L, R2) → (bA1L, R1)      ligne radiale sortante gauche de l'anneau
 *   4. Arc CW sur R1 : bA1L → bA1R  arc extérieur (toujours sweep=1)
 *   5. (bA1R, R1) → (bA1R, R2)      ligne radiale rentrante droite de l'anneau
 *   6. Arc sur R2 : bA1R → bA2R     encoche droite
 *   7. Z ferme (bA2R, R2) → centre  ligne radiale droite du secteur intérieur
 *
 * Direction des encoches R2 :
 *   A2 < A1 → bA2 est entre bA1L et bA1R → encoches CCW (sweep=0)
 *   A2 > A1 → bA2 dépasse bA1 → encoches CW (sweep=1)
 */
export function faiKeyholeOutlinePathD(
  bA2Left: number,
  bA2Right: number,
  bA1Left: number,
  bA1Right: number,
  outerR: number,
  innerR: number
): string {
  const halfGap = Math.abs(((bA2Left - bA1Left + 180) % 360) - 180);
  const gapLarge = halfGap > 90 ? 1 : 0;
  const outerSpan = ((bA1Right - bA1Left) % 360 + 360) % 360;
  const outerLarge = outerSpan > 180 ? 1 : 0;

  const a2WideThanA1 = ((bA2Left - bA1Left + 360) % 360) > 180;
  const gapSweep = a2WideThanA1 ? 1 : 0;

  return [
    `M ${CX} ${CY}`,
    `L ${pt(bA2Left, innerR)}`,
    `A ${innerR} ${innerR} 0 ${gapLarge} ${gapSweep} ${pt(bA1Left, innerR)}`,
    `L ${pt(bA1Left, outerR)}`,
    `A ${outerR} ${outerR} 0 ${outerLarge} 1 ${pt(bA1Right, outerR)}`,
    `L ${pt(bA1Right, innerR)}`,
    `A ${innerR} ${innerR} 0 ${gapLarge} ${gapSweep} ${pt(bA2Right, innerR)}`,
    'Z'
  ].join(' ');
}

function faiKeyholePreviewPath(
  zone: ObservationZoneConfig,
  ctx: ObsZoneLegContext
): string | null {
  if (
    !hasFaiInnerSector(zone) ||
    zone.a1Deg == null ||
    zone.r2M == null ||
    zone.r2M <= 0
  ) {
    return null;
  }
  const brg = cupZoneReferenceBearingDeg(zone, ctx);
  const halfA1 = zone.a1Deg / 2;
  const halfA2 = zone.a2Deg! / 2;
  const innerNorm = previewInnerRadiusM(zone.r1M, zone.r2M);
  return faiKeyholeOutlinePathD(
    brg - halfA2,
    brg + halfA2,
    brg - halfA1,
    brg + halfA1,
    MAX_R,
    innerNorm
  );
}

function shapeToPreviewPath(shape: ObsZoneMapShape): string | undefined {
  switch (shape.kind) {
    case 'sector':
      return sectorPathD(shape.startBearingDeg ?? 0, shape.endBearingDeg ?? 360);

    case 'ring-sector': {
      const outer = shape.radiusM ?? MAX_R;
      const inner = shape.innerRadiusM ?? outer * 0.35;
      const innerNorm = previewInnerRadiusM(outer, inner);
      return sectorPathD(
        shape.startBearingDeg ?? 0,
        shape.endBearingDeg ?? 360,
        MAX_R,
        innerNorm
      );
    }

    default:
      return undefined;
  }
}

function mapShapesToPreview(
  shapes: ObsZoneMapShape[],
  zone: ObservationZoneConfig,
  ctx: ObsZoneLegContext
): ObsZonePreviewView {
  const primary = shapes[0];
  const base: ObsZonePreviewView = {
    kind: primary.kind,
    role: primary.role,
    label: primary.label
  };

  if (primary.kind === 'circle') {
    return {
      ...base,
      circleR: MAX_R,
      markers: orientationMarkers(zone, ctx, primary)
    };
  }

  if (primary.kind === 'line') {
    return {
      ...base,
      line: lineSegmentFromShape(primary)
    };
  }

  const keyholePath = faiKeyholePreviewPath(zone, ctx);
  const pathDs = keyholePath
    ? [keyholePath]
    : shapes.map(s => shapeToPreviewPath(s)).filter((d): d is string => Boolean(d));

  if (pathDs.length > 0) {
    return {
      ...base,
      kind: shapes.length > 1 ? 'ring-sector' : primary.kind,
      pathDs,
      pathD: pathDs[0]
    };
  }

  return { ...base, circleR: MAX_R };
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
  return mapShapesToPreview(shapes, zone, ctx);
}
