import { CircuitLegRole } from '../models/circuit.model';
import {
  CUP_STYLE_LABELS,
  CupZoneParamKey,
  ObservationZoneConfig,
  cupZoneParamVisibility
} from '../models/observation-zone.model';

export const OBS_ZONE_CUP_DIAGRAM_VIEWBOX = '0 0 320 220';
export const OBS_ZONE_CUP_CENTER = { cx: 160, cy: 110 };

const CX = OBS_ZONE_CUP_CENTER.cx;
const CY = OBS_ZONE_CUP_CENTER.cy;
const R1_DRAW = 78;
const NORTH_Y = 16;
const VIEWBOX_BOUNDS = { minX: 12, maxX: 308, minY: 14, maxY: 208 };
const NORTH_LABEL = { x: CX, y: NORTH_Y };
const NORTH_CLEAR_RADIUS = 30;

export interface CupDiagramArc {
  pathD: string;
  stroke: string;
  fill: string;
  label: string;
  paramKey: CupParamKey;
}

export interface CupDiagramLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  label?: string;
  paramKey?: CupParamKey;
}

export interface CupDiagramCircle {
  cx: number;
  cy: number;
  r: number;
  stroke: string;
  fill: string;
  strokeDasharray?: string;
  label: string;
  paramKey: CupParamKey;
}

export type CupParamKey = CupZoneParamKey;

export interface CupParamLegendItem {
  key: CupParamKey;
  cupLabel: string;
  value: string;
  active: boolean;
  hint: string;
}

export interface CupDiagramLabel {
  x: number;
  y: number;
  text: string;
  anchor?: 'start' | 'middle' | 'end';
  paramKey?: CupParamKey;
  /** Point d’ancrage sur la géométrie (trait de rappel). */
  leader?: { x: number; y: number };
}

export interface ObsZoneCupDiagramView {
  params: CupParamLegendItem[];
  circles: CupDiagramCircle[];
  arcs: CupDiagramArc[];
  lines: CupDiagramLine[];
  labels: CupDiagramLabel[];
  styleArrow?: CupDiagramLine;
}

function polar(bearingDeg: number, radius: number): [number, number] {
  const rad = (bearingDeg * Math.PI) / 180;
  return [CX + radius * Math.sin(rad), CY - radius * Math.cos(rad)];
}

function offsetFrom(x: number, y: number, bearingDeg: number, distance: number): [number, number] {
  const rad = (bearingDeg * Math.PI) / 180;
  return [x + distance * Math.sin(rad), y - distance * Math.cos(rad)];
}

function textAnchorForBearing(bearingDeg: number): 'start' | 'middle' | 'end' {
  const b = ((bearingDeg % 360) + 360) % 360;
  if (b > 25 && b < 155) return 'start';
  if (b > 205 && b < 335) return 'end';
  return 'middle';
}

/** Décalage perpendiculaire à l'arc (extérieur du secteur). */
function outwardFromArcPoint(arcBearingDeg: number): number {
  return (arcBearingDeg + 90) % 360;
}

function labelFootprintRadius(text: string): number {
  return Math.max(12, text.length * 2.1);
}

function pushParamLabel(
  labels: CupDiagramLabel[],
  anchorX: number,
  anchorY: number,
  outwardBearing: number,
  outwardPx: number,
  text: string,
  paramKey: CupParamKey
): void {
  const [x, y] = offsetFrom(anchorX, anchorY, outwardBearing, outwardPx);
  labels.push({
    x,
    y,
    text,
    paramKey,
    anchor: textAnchorForBearing(outwardBearing),
    leader: { x: anchorX, y: anchorY }
  });
}

/** Sur l'arc du secteur : position 0–1 entre les bords. */
function pushLabelOnArc(
  labels: CupDiagramLabel[],
  startBrg: number,
  sweepDeg: number,
  t: number,
  radius: number,
  outwardPx: number,
  text: string,
  paramKey: CupParamKey
): void {
  const arcBrg = startBrg + sweepDeg * t;
  const [ax, ay] = polar(arcBrg, radius);
  pushParamLabel(labels, ax, ay, outwardFromArcPoint(arcBrg), outwardPx, text, paramKey);
}

/** Écarte les libellés (traits de rappel inchangés). */
function resolveLabelCollisions(labels: CupDiagramLabel[]): void {
  const movable = labels.filter(l => l.text !== 'N');
  const north = labels.find(l => l.text === 'N');
  const maxIter = 28;

  for (let iter = 0; iter < maxIter; iter++) {
    let moved = false;

    for (let i = 0; i < movable.length; i++) {
      for (let j = i + 1; j < movable.length; j++) {
        const a = movable[i];
        const b = movable[j];
        const minDist = labelFootprintRadius(a.text) + labelFootprintRadius(b.text) + 3;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= minDist || d < 0.01) {
          continue;
        }
        const push = (minDist - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        moved = true;
      }
    }

    if (north) {
      for (const m of movable) {
        const minDist = NORTH_CLEAR_RADIUS + labelFootprintRadius(m.text) * 0.45;
        const dx = m.x - north.x;
        const dy = m.y - north.y;
        const d = Math.hypot(dx, dy);
        if (d >= minDist || d < 0.01) {
          continue;
        }
        const push = minDist - d;
        m.x += (dx / d) * push;
        m.y += (dy / d) * push;
        moved = true;
      }
    }

    for (const m of movable) {
      m.x = Math.max(VIEWBOX_BOUNDS.minX, Math.min(VIEWBOX_BOUNDS.maxX, m.x));
      m.y = Math.max(NORTH_Y + 18, Math.min(VIEWBOX_BOUNDS.maxY, m.y));
    }

    if (!moved) {
      break;
    }
  }
}

function sectorPathD(
  startBearingDeg: number,
  sweepDeg: number,
  outerR: number,
  innerR = 0
): string {
  const end = startBearingDeg + sweepDeg;
  const [x0, y0] = polar(startBearingDeg, outerR);
  const [x1, y1] = polar(end, outerR);
  const large = sweepDeg > 180 ? 1 : 0;

  if (innerR <= 0) {
    return `M ${CX} ${CY} L ${x0} ${y0} A ${outerR} ${outerR} 0 ${large} 1 ${x1} ${y1} Z`;
  }

  const [xi0, yi0] = polar(end, innerR);
  const [xi1, yi1] = polar(startBearingDeg, innerR);
  return [
    `M ${x0} ${y0}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${x1} ${y1}`,
    `L ${xi0} ${yi0}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${xi1} ${yi1}`,
    'Z'
  ].join(' ');
}

function formatMeters(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)} km` : `${m} m`;
}

function buildLegend(
  zone: ObservationZoneConfig,
  axisBearingDeg: number,
  isSector: boolean
): CupParamLegendItem[] {
  const hasA1 = zone.a1Deg != null && zone.a1Deg > 0;
  const hasR2 = zone.r2M != null && zone.r2M > 0;
  const hasA2 = zone.a2Deg != null && Number.isFinite(zone.a2Deg);
  const hasA12 = zone.a12Deg != null && Number.isFinite(zone.a12Deg);

  const axisInfo = isSector ? ` · axe ${Math.round(axisBearingDeg)}°` : '';

  return [
    {
      key: 'style',
      cupLabel: 'Style',
      value: String(zone.cupStyle),
      active: true,
      hint: CUP_STYLE_LABELS[zone.cupStyle] + axisInfo
    },
    {
      key: 'r1',
      cupLabel: 'R1',
      value: formatMeters(zone.r1M),
      active: true,
      hint: 'Rayon extérieur principal'
    },
    {
      key: 'a1',
      cupLabel: 'A1',
      value: hasA1 ? `${zone.a1Deg}°` : '—',
      active: hasA1,
      hint: hasA1 ? `±${Math.round(zone.a1Deg! / 2)}° autour de l'axe` : 'Ouverture du secteur'
    },
    {
      key: 'r2',
      cupLabel: 'R2',
      value: hasR2 ? formatMeters(zone.r2M!) : '—',
      active: hasR2,
      hint: 'Rayon intérieur (trou / keyhole FAI)'
    },
    {
      key: 'a2',
      cupLabel: 'A2',
      value: hasA2 ? `${zone.a2Deg}°` : '—',
      active: hasA2,
      hint: 'Ouverture du secteur intérieur sur R2'
    },
    {
      key: 'a12',
      cupLabel: 'A12',
      value: hasA12 ? `${zone.a12Deg}°` : '—',
      active: zone.cupStyle === 0 && hasA12,
      hint:
        zone.cupStyle === 0 && hasA12
          ? `Cap CUP → axe ${Math.round(axisBearingDeg)}° (A12+180°)`
          : 'Cap de référence (Style 0 uniquement)'
    },
    {
      key: 'line',
      cupLabel: 'Line',
      value: zone.line ? '1' : '0',
      active: Boolean(zone.line),
      hint: zone.line ? 'Ligne de porte active' : 'Zone pleine (pas de ligne)'
    }
  ];
}

/** Schéma pédagogique des paramètres CUP (vue de dessus, nord en haut). */
export function buildObsZoneCupDiagram(
  zone: ObservationZoneConfig,
  referenceBearingDeg = 0,
  legRole?: CircuitLegRole
): ObsZoneCupDiagramView {
  const axisBearing = referenceBearingDeg;
  const circles: CupDiagramCircle[] = [];
  const arcs: CupDiagramArc[] = [];
  const lines: CupDiagramLine[] = [];
  const labels: CupDiagramLabel[] = [];

  const hasA1 = zone.a1Deg != null && zone.a1Deg > 0 && zone.a1Deg < 360;
  const hasR2 = zone.r2M != null && zone.r2M > 0;
  const isLine = Boolean(zone.line);
  const isSector = hasA1 && !isLine;
  const isRing = isSector && hasR2;

  const visibility = cupZoneParamVisibility(zone, { legRole });
  const params = buildLegend(zone, axisBearing, isSector)
    .filter(p => visibility[p.key])
    .filter(p => p.active || p.key === 'style' || p.key === 'r1');

  const halfA1 = hasA1 ? zone.a1Deg! / 2 : 0;
  const startBrg = axisBearing - halfA1;
  const sideBrg = (axisBearing + 90) % 360;

  circles.push({
    cx: CX,
    cy: CY,
    r: R1_DRAW,
    stroke: '#d97706',
    fill: 'rgba(251, 191, 36, 0.15)',
    strokeDasharray: isSector ? '4 3' : undefined,
    label: `R1 ${formatMeters(zone.r1M)}`,
    paramKey: 'r1'
  });

  let innerR = 0;
  if (visibility.r2 && isRing) {
    innerR = Math.max(18, (zone.r2M! / zone.r1M) * R1_DRAW);
    circles.push({
      cx: CX,
      cy: CY,
      r: innerR,
      stroke: '#0d9488',
      fill: 'rgba(45, 212, 191, 0.12)',
      strokeDasharray: '3 2',
      label: `R2 ${formatMeters(zone.r2M!)}`,
      paramKey: 'r2'
    });
  }

  if (visibility.a1 && isSector) {
    arcs.push({
      pathD: sectorPathD(startBrg, zone.a1Deg!, R1_DRAW, isRing ? innerR : 0),
      stroke: '#7c3aed',
      fill: 'rgba(167, 139, 250, 0.22)',
      label: `A1 ${zone.a1Deg}°`,
      paramKey: 'a1'
    });
  }

  if (visibility.a2 && zone.a2Deg != null && zone.a2Deg > 0 && isRing) {
    const halfA2 = zone.a2Deg / 2;
    arcs.push({
      pathD: sectorPathD(axisBearing - halfA2, zone.a2Deg, innerR, 0),
      stroke: '#db2777',
      fill: 'rgba(244, 114, 182, 0.25)',
      label: `A2 ${zone.a2Deg}°`,
      paramKey: 'a2'
    });
  }

  if (visibility.a12 && zone.a12Deg != null && zone.a12Deg > 0) {
    const [a12x, a12y] = polar(zone.a12Deg, R1_DRAW - 6);
    lines.push({
      x1: CX,
      y1: CY,
      x2: a12x,
      y2: a12y,
      stroke: '#64748b',
      strokeWidth: 1.5,
      strokeDasharray: '3 2',
      paramKey: 'a12'
    });
  }

  if (visibility.line && isLine) {
    const halfLen = 88;
    lines.push({
      x1: CX - halfLen,
      y1: CY,
      x2: CX + halfLen,
      y2: CY,
      stroke: '#dc2626',
      strokeWidth: 3,
      label: 'Line=1',
      paramKey: 'line'
    });
    labels.push({ x: CX, y: CY + 20, text: 'Line', anchor: 'middle', paramKey: 'line' });
  }

  const styleColors = ['#2563eb', '#2563eb', '#16a34a', '#ca8a04', '#9333ea'];
  const [sx, sy] = polar(axisBearing, R1_DRAW - 8);
  const styleArrow: CupDiagramLine = {
    x1: CX,
    y1: CY,
    x2: sx,
    y2: sy,
    stroke: styleColors[zone.cupStyle] ?? '#2563eb',
    strokeWidth: 2.5,
    paramKey: 'style'
  };

  // Libellés répartis sur l'arc et les côtés opposés (jamais empilés sur l'axe)
  const [r1Ax, r1Ay] = polar(sideBrg, R1_DRAW * 0.62);
  pushParamLabel(labels, r1Ax, r1Ay, sideBrg, 13, `R1 ${formatMeters(zone.r1M)}`, 'r1');

  if (visibility.a1 && isSector) {
    const a1T = zone.a1Deg! > 100 ? 0.22 : 0.5;
    pushLabelOnArc(labels, startBrg, zone.a1Deg!, a1T, R1_DRAW, 11, `A1 ${zone.a1Deg}°`, 'a1');
  }

  if (visibility.r2 && isRing) {
    const [r2Ax, r2Ay] = polar((sideBrg + 180) % 360, innerR);
    pushParamLabel(
      labels,
      r2Ax,
      r2Ay,
      (sideBrg + 180) % 360,
      11,
      `R2 ${formatMeters(zone.r2M!)}`,
      'r2'
    );
  }

  if (visibility.a2 && zone.a2Deg != null && zone.a2Deg > 0 && isRing) {
    const a2Start = axisBearing - zone.a2Deg / 2;
    pushLabelOnArc(labels, a2Start, zone.a2Deg, 0.5, innerR, 10, `A2 ${zone.a2Deg}°`, 'a2');
  }

  if (visibility.a12 && zone.a12Deg != null && zone.a12Deg > 0) {
    const [a12Ax, a12Ay] = polar(zone.a12Deg, R1_DRAW * 0.38);
    pushParamLabel(
      labels,
      a12Ax,
      a12Ay,
      outwardFromArcPoint(zone.a12Deg),
      11,
      `A12 ${zone.a12Deg}°`,
      'a12'
    );
  }

  if (isSector) {
    const styleT = zone.a1Deg! > 100 ? 0.78 : 0.22;
    pushLabelOnArc(
      labels,
      startBrg,
      zone.a1Deg!,
      styleT,
      R1_DRAW,
      12,
      `${Math.round(axisBearing)}°`,
      'style'
    );
  }

  labels.push({ x: NORTH_LABEL.x, y: NORTH_LABEL.y, text: 'N', anchor: 'middle' });
  resolveLabelCollisions(labels);
  lines.push({
    x1: CX,
    y1: CY - 92,
    x2: CX,
    y2: CY - 72,
    stroke: '#64748b',
    strokeWidth: 1.5
  });

  return {
    params,
    circles,
    arcs,
    lines,
    labels,
    styleArrow
  };
}
