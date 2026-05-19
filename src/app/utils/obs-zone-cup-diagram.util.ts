import { CircuitLegRole } from '../models/circuit.model';
import {
  CUP_STYLE_LABELS,
  CupZoneParamKey,
  ObservationZoneConfig,
  cupZoneParamVisibility
} from '../models/observation-zone.model';
export const OBS_ZONE_CUP_DIAGRAM_VIEWBOX = '0 0 220 150';

const CX = 110;
const CY = 78;
const R1_DRAW = 52;

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

export interface ObsZoneCupDiagramView {
  params: CupParamLegendItem[];
  circles: CupDiagramCircle[];
  arcs: CupDiagramArc[];
  lines: CupDiagramLine[];
  labels: { x: number; y: number; text: string; anchor?: 'start' | 'middle' | 'end' }[];
  styleArrow?: CupDiagramLine;
}

function polar(bearingDeg: number, radius: number): [number, number] {
  const rad = (bearingDeg * Math.PI) / 180;
  return [CX + radius * Math.sin(rad), CY - radius * Math.cos(rad)];
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
  axisBearingDeg: number
): CupParamLegendItem[] {
  const hasA1 = zone.a1Deg != null && zone.a1Deg > 0;
  const hasR2 = zone.r2M != null && zone.r2M > 0;
  const hasA2 = zone.a2Deg != null && Number.isFinite(zone.a2Deg);
  const hasA12 = zone.a12Deg != null && Number.isFinite(zone.a12Deg);

  return [
    {
      key: 'style',
      cupLabel: 'Style',
      value: String(zone.cupStyle),
      active: true,
      hint: CUP_STYLE_LABELS[zone.cupStyle]
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
      hint: 'Largeur angulaire du secteur extérieur (±A1 autour de l’axe)'
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
      hint: 'Ouverture du secteur intérieur sur R2 (même axe que A1)'
    },
    {
      key: 'a12',
      cupLabel: 'A12',
      value: hasA12 ? `${zone.a12Deg}°` : '—',
      active: zone.cupStyle === 0 && hasA12,
      hint:
        zone.cupStyle === 0
          ? hasA12
            ? `Style fixe : cap dans le CUP ; axe du secteur ≈ ${axisBearingDeg}° (A12+180°)`
            : 'Style fixe : cap d’orientation (sinon nord)'
          : hasA12
            ? 'Ignoré si Style ≠ 0 (orientation par Style + circuit)'
            : 'Utilisé seulement en Style 0 (fixe)'
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
  const visibility = cupZoneParamVisibility(zone, { legRole });
  const params = buildLegend(zone, axisBearing).filter(p => visibility[p.key]);
  const circles: CupDiagramCircle[] = [];
  const arcs: CupDiagramArc[] = [];
  const lines: CupDiagramLine[] = [];
  const labels: ObsZoneCupDiagramView['labels'] = [];

  const hasA1 = zone.a1Deg != null && zone.a1Deg > 0 && zone.a1Deg < 360;
  const hasR2 = zone.r2M != null && zone.r2M > 0;
  const isLine = Boolean(zone.line);
  const isSector = hasA1 && !isLine;
  const isRing = isSector && hasR2;

  const halfA1 = hasA1 ? zone.a1Deg! / 2 : 0;
  const startBrg = axisBearing - halfA1;

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

  if (visibility.r2 && isRing) {
    const innerR = Math.max(12, (zone.r2M! / zone.r1M) * R1_DRAW);
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
      pathD: sectorPathD(startBrg, zone.a1Deg!, R1_DRAW, isRing ? Math.max(12, (zone.r2M! / zone.r1M) * R1_DRAW) : 0),
      stroke: '#7c3aed',
      fill: 'rgba(167, 139, 250, 0.22)',
      label: `A1 ${zone.a1Deg}°`,
      paramKey: 'a1'
    });
    const [ax, ay] = polar(axisBearing, R1_DRAW + 10);
    labels.push({ x: ax, y: ay, text: `axe ${Math.round(axisBearing)}°`, anchor: 'middle' });
    labels.push({
      x: CX,
      y: CY + R1_DRAW + 12,
      text: `A1=${zone.a1Deg}° (±${halfA1}°)`,
      anchor: 'middle'
    });
  }

  if (hasR2 && !isSector) {
    labels.push({
      x: CX + R1_DRAW * 0.55,
      y: CY - 8,
      text: `R2=${formatMeters(zone.r2M!)}`,
      anchor: 'start'
    });
  }

  if (visibility.a2 && zone.a2Deg != null && zone.a2Deg > 0 && isRing) {
    const innerR = Math.max(12, (zone.r2M! / zone.r1M) * R1_DRAW);
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
    const [a12x, a12y] = polar(zone.a12Deg, R1_DRAW - 4);
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
    labels.push({
      x: a12x,
      y: a12y - 6,
      text: `A12=${zone.a12Deg}°`,
      anchor: 'middle'
    });
  }

  if (visibility.line && isLine) {
    const halfLen = 58;
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
    labels.push({ x: CX, y: CY + 14, text: 'Line=1', anchor: 'middle' });
  }

  const styleColors = ['#2563eb', '#2563eb', '#16a34a', '#ca8a04', '#9333ea'];
  const [sx, sy] = polar(axisBearing, R1_DRAW - 6);
  const styleArrow: CupDiagramLine = {
    x1: CX,
    y1: CY,
    x2: sx,
    y2: sy,
    stroke: styleColors[zone.cupStyle] ?? '#2563eb',
    strokeWidth: 2.5,
    paramKey: 'style'
  };

  labels.push({ x: CX, y: 12, text: 'N', anchor: 'middle' });
  lines.push({
    x1: CX,
    y1: CY - 62,
    x2: CX,
    y2: CY - 48,
    stroke: '#64748b',
    strokeWidth: 1.5
  });

  if (!isSector && !isLine) {
    labels.push({
      x: CX + R1_DRAW + 6,
      y: CY,
      text: `R1`,
      anchor: 'start'
    });
  }

  return {
    params,
    circles,
    arcs,
    lines,
    labels,
    styleArrow
  };
}
