import type { EnvelopeSample } from '../services/glide-envelope.service';

export interface ChartGeometryLike {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  xMin: number;
  xMax: number;
}

export interface QualityBandBase {
  key: string;
  x: number;
  width: number;
  yTop: number;
  yBottom: number;
}

export type TerrainBandQuality = 'missing' | 'estimated' | 'dem-low';

export function buildQualityBands(
  data: EnvelopeSample[],
  g: ChartGeometryLike,
  quality: TerrainBandQuality
): QualityBandBase[] {
  const plotW = g.width - g.padding.left - g.padding.right;
  const plotH = g.height - g.padding.top - g.padding.bottom;
  const xKm = (km: number): number =>
    g.padding.left + ((km - g.xMin) / (g.xMax - g.xMin)) * plotW;
  const yTop = g.padding.top;
  const yBottom = g.padding.top + plotH;
  const minBandPx = 4;
  const bands: QualityBandBase[] = [];
  let runStart: number | null = null;
  let runEndKm = 0;

  const flush = (): void => {
    if (runStart == null) return;
    const x0 = xKm(runStart);
    const x1 = xKm(runEndKm);
    const left = Math.min(x0, x1) - minBandPx * 0.5;
    const right = Math.max(x0, x1) + minBandPx * 0.5;
    const width = Math.max(minBandPx, right - left);
    bands.push({
      key: `${quality}-${runStart}-${runEndKm}`,
      x: left,
      width,
      yTop,
      yBottom
    });
    runStart = null;
  };

  for (const s of data) {
    if (s.terrainQuality === quality) {
      if (runStart == null) runStart = s.distanceKm;
      runEndKm = s.distanceKm;
    } else {
      flush();
    }
  }
  flush();
  return bands;
}

export function buildQualityAreaPath(
  data: EnvelopeSample[],
  x: (km: number) => number,
  y: (m: number) => number,
  baseY: number,
  quality: 'estimated' | 'dem-low'
): string {
  const pts = data.filter(
    s => s.terrainQuality === quality && s.terrainM != null
  );
  if (pts.length === 0) return '';
  const top = pts.map(s => `${x(s.distanceKm)},${y(s.terrainM as number)}`);
  const first = pts[0];
  const last = pts[pts.length - 1];
  return `M ${top[0]} L ${top.slice(1).join(' L ')} L ${x(last.distanceKm)},${baseY} L ${x(first.distanceKm)},${baseY} Z`;
}
