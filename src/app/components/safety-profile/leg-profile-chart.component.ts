import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  OnDestroy,
  output,
  signal,
  viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type {
  EnvelopeSample,
  LandableConeSample,
  LandableConeVisual
} from '../../services/glide-envelope.service';
import {
  collectActiveConeCrossings,
  interpolateSafetyM
} from '../../utils/safety-cone-crossings.util';
import { landableColorFromId } from '../../utils/safety-profile-palette.util';
import {
  buildQualityAreaPath,
  buildQualityBands,
  type QualityBandBase,
  type TerrainBandQuality
} from '../../utils/leg-profile-chart.geometry';
import type { LegAirspaceProfileBand } from '../../utils/leg-airspace-profile-cross-section.util';
import { formatMetersDisplay } from '../../utils/airspace-altitude.util';
import {
  buildSafetyMinAltitudeChartSegments,
  buildSafetyMinAltitudeTerrainMarginSections,
  type SafetyMinAltitudeChartSegment
} from '../../utils/safety-min-altitude-style.util';
import { SAFETY_MIN_ALTITUDE_TERRAIN_COLOR } from '../../utils/safety-profile-chart.util';

export interface LegEndpointInfo {
  name: string;
  elevationM: number | null;
}

export interface LegChartLabels {
  terrain: string;
  groundClearance: string;
  glideCone: string;
  safety: string;
  distance: string;
  altitude: string;
  noLandables: string;
  tooltipDistance: string;
  tooltipTerrain: string;
  tooltipCone: string;
  tooltipGround: string;
  tooltipSafety: string;
  landableColors: string;
  landableConeBelowMin: string;
  tooltipLandablesTitle: string;
  tooltipLandableAt: string;
  conesTruncated: string;
  coneIntersectionAltitude: string;
  terrainMissing: string;
  terrainEstimated: string;
  legendTerrainMissing: string;
  legendTerrainEstimated: string;
  tooltipTerrainMissing: string;
  tooltipTerrainEstimated: string;
  terrainLowFidelity: string;
  legendTerrainLowFidelity: string;
  tooltipTerrainLowFidelity: string;
  legendAirspaceZones: string;
}

interface AirspaceBandDraw {
  key: string;
  x: number;
  width: number;
  yTop: number;
  yBottom: number;
  fill: string;
  name: string;
  hovered: boolean;
}

interface ChartGeometry {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

interface ChartSeries {
  terrainPath: string;
  terrainAreaPath: string;
  terrainEstimatedPath: string;
  terrainEstimatedAreaPath: string;
  terrainLowFidelityPath: string;
  terrainLowFidelityAreaPath: string;
  groundLinePath: string;
  conePath: string;
  safetySegments: SafetyMinAltitudeChartSegment[];
}

interface SafetyTerrainMarginChartLabel {
  key: string;
  x: number;
  y: number;
  text: string;
}

/** Décalage MSL au-dessus de la ligne d'altitude min sur la coupe. */
const SAFETY_MARGIN_LABEL_ALT_OFFSET_M = 18;

interface TerrainMissingBand {
  key: string;
  x: number;
  width: number;
  centerX: number;
  yTop: number;
  yBottom: number;
}

type TerrainEstimatedBand = QualityBandBase;

interface TerrainEstimatedMark {
  key: string;
  x: number;
  y: number;
  altitudeM: number;
}

interface ConePathSegment {
  path: string;
  /** Segment sous l'altitude min combinée (relief + cônes). */
  belowMin: boolean;
}

interface LandableLayerDraw {
  id: string;
  color: string;
  coneSegments: ConePathSegment[];
  stemPath: string;
  markerX: number;
  markerY: number;
  labelY: number;
  label: string;
  isBinding: boolean;
}

/** Repère d'intersection entre cônes ou avec l'altitude min (rouge). */
interface ConeIntersectionMark {
  key: string;
  x: number;
  y: number;
  labelY: number;
  text: string;
  color: string;
}

interface LandableAtHover {
  name: string;
  shortName: string;
  color: string;
  altitudeM: number;
  isBinding: boolean;
}

interface AxisTick {
  value: number;
  position: number;
  label: string;
}

export const LEG_PROFILE_PRINT_WIDTH = 1800;
export const LEG_PROFILE_PRINT_HEIGHT = 420;

const CHART_WIDTH_DEFAULT = 800;
const CHART_HEIGHT_DEFAULT = 280;
const MIN_CHART_WIDTH = 280;
const MIN_CHART_HEIGHT = 140;

function chartPadding(width: number, height: number): ChartGeometry['padding'] {
  return {
    top: Math.max(16, Math.round(height * 0.06)),
    right: Math.max(20, Math.round(width * 0.028)),
    bottom: Math.max(40, Math.round(height * 0.14)),
    left: Math.max(44, Math.round(width * 0.06))
  };
}

@Component({
  selector: 'app-leg-profile-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leg-profile-chart.component.html',
  styleUrls: ['./leg-profile-chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LegProfileChartComponent implements AfterViewInit, OnDestroy {
  private readonly chartHost =
    viewChild.required<ElementRef<HTMLElement>>('chartHost');
  private resizeObserver: ResizeObserver | null = null;

  /** Dimensions du conteneur (px) — le viewBox SVG suit pour remplir la largeur. */
  private readonly chartSize = signal({
    width: CHART_WIDTH_DEFAULT,
    height: CHART_HEIGHT_DEFAULT
  });
  samples = input.required<EnvelopeSample[]>();
  landableCones = input<LandableConeVisual[]>([]);
  fromEndpoint = input.required<LegEndpointInfo>();
  toEndpoint = input.required<LegEndpointInfo>();
  arrivalMarginM = input.required<number>();
  labels = input.required<LegChartLabels>();
  noLandables = input(false);
  conesTruncated = input(false);
  /** Début réel de la branche sur l'axe distance (km), en général 0. */
  legStartKm = input(0);
  /** Fin réelle de la branche (km), peut être inférieure à la fin de la coupe. */
  legEndKm = input<number | null>(null);
  /** Sommet de l'échelle verticale (m MSL) — fixe l'altitude max affichée. */
  yMaxM = input.required<number>();
  /** Couleurs par id (branche), alignées sur les puces / cônes carte. */
  landableColors = input<Record<string, string>>({});
  /** Bandes d'espace aérien (intersection zone × segment de branche). */
  airspaceBands = input<LegAirspaceProfileBand[]>([]);
  hoveredAirspaceZoneKey = input<string | null>(null);

  hoveredSample = signal<EnvelopeSample | null>(null);

  private landableColor(id: string): string {
    return this.landableColors()[id] ?? landableColorFromId(id);
  }

  /** Position le long de la branche (coordonnées échantillon DEM). */
  readonly sampleHover = output<EnvelopeSample | null>();

  readonly geometry = computed<ChartGeometry>(() => {
    const data = this.samples();
    const xMin = 0;
    const xMax = data.length > 0 ? data[data.length - 1].distanceKm : 1;
    const allYs: number[] = [];
    for (const s of data) {
      if (s.terrainM != null) allYs.push(s.terrainM);
      if (s.groundClearanceM != null) allYs.push(s.groundClearanceM);
      if (s.glideConeM != null && Number.isFinite(s.glideConeM)) {
        allYs.push(s.glideConeM);
      }
      if (s.safetyM != null && Number.isFinite(s.safetyM)) {
        allYs.push(s.safetyM);
      }
    }
    for (const cone of this.landableCones()) {
      allYs.push(cone.baseAltitudeM);
      for (const pt of cone.curve) {
        allYs.push(pt.altitudeM);
      }
    }
    for (const band of this.airspaceBands()) {
      allYs.push(band.floorM, band.ceilingM);
    }
    const fromE = this.fromEndpoint().elevationM;
    const toE = this.toEndpoint().elevationM;
    if (fromE != null) allYs.push(fromE, fromE + this.arrivalMarginM());
    if (toE != null) allYs.push(toE, toE + this.arrivalMarginM());

    const yMax = Math.max(1000, this.yMaxM());
    let yMin: number;
    if (allYs.length === 0) {
      yMin = 0;
    } else {
      yMin = Math.min(...allYs);
      const pad = Math.max(50, (yMax - yMin) * 0.05);
      yMin = Math.max(0, Math.floor((yMin - pad) / 1000) * 1000);
      if (yMin >= yMax) {
        yMin = Math.max(0, yMax - 1000);
      }
    }

    const size = this.chartSize();
    return {
      width: size.width,
      height: size.height,
      padding: chartPadding(size.width, size.height),
      xMin,
      xMax: xMax === xMin ? xMin + 1 : xMax,
      yMin,
      yMax
    };
  });

  ngAfterViewInit(): void {
    const el = this.chartHost().nativeElement;
    const applySize = (): void => {
      const rect = el.getBoundingClientRect();
      const width = Math.round(rect.width);
      if (width < MIN_CHART_WIDTH) return;
      const measured = Math.round(rect.height);
      const height =
        measured >= MIN_CHART_HEIGHT
          ? measured
          : Math.max(MIN_CHART_HEIGHT, Math.round(width * 0.35));
      const prev = this.chartSize();
      if (prev.width === width && prev.height === height) return;
      this.chartSize.set({ width, height });
    };

    applySize();
    requestAnimationFrame(() => {
      applySize();
      requestAnimationFrame(() => applySize());
    });
    this.resizeObserver = new ResizeObserver(() => applySize());
    this.resizeObserver.observe(el);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  readonly series = computed<ChartSeries>(() => {
    const g = this.geometry();
    const data = this.samples();
    const plotW = g.width - g.padding.left - g.padding.right;
    const plotH = g.height - g.padding.top - g.padding.bottom;
    const x = (km: number): number =>
      g.padding.left + ((km - g.xMin) / (g.xMax - g.xMin)) * plotW;
    const y = (m: number): number =>
      g.padding.top + plotH - ((m - g.yMin) / (g.yMax - g.yMin)) * plotH;

    if (data.length === 0) {
      return {
        terrainPath: '',
        terrainAreaPath: '',
        terrainEstimatedPath: '',
        terrainEstimatedAreaPath: '',
        terrainLowFidelityPath: '',
        terrainLowFidelityAreaPath: '',
        groundLinePath: '',
        conePath: '',
        safetySegments: []
      };
    }

    const terrainPoints: string[] = [];
    const lowFidelityPoints: string[] = [];
    const estimatedPoints: string[] = [];
    const groundPoints: string[] = [];
    const conePoints: string[] = [];
    for (const s of data) {
      if (s.terrainM != null && s.terrainQuality === 'dem') {
        terrainPoints.push(`${x(s.distanceKm)},${y(s.terrainM)}`);
      } else if (s.terrainM != null && s.terrainQuality === 'dem-low') {
        lowFidelityPoints.push(`${x(s.distanceKm)},${y(s.terrainM)}`);
      } else if (s.terrainM != null && s.terrainQuality === 'estimated') {
        estimatedPoints.push(`${x(s.distanceKm)},${y(s.terrainM)}`);
      }
      if (s.groundClearanceM != null) {
        groundPoints.push(`${x(s.distanceKm)},${y(s.groundClearanceM)}`);
      }
      if (s.glideConeM != null && Number.isFinite(s.glideConeM)) {
        conePoints.push(`${x(s.distanceKm)},${y(s.glideConeM)}`);
      }
    }

    const baseY = y(g.yMin);
    const terrainAreaPath = terrainPoints.length
      ? `M ${terrainPoints[0]} L ${terrainPoints.join(' L ')} L ${x(data[data.length - 1].distanceKm)},${baseY} L ${x(data[0].distanceKm)},${baseY} Z`
      : '';

    const estimatedAreaPath = buildQualityAreaPath(data, x, y, baseY, 'estimated');
    const lowFidelityAreaPath = buildQualityAreaPath(data, x, y, baseY, 'dem-low');

    return {
      terrainPath: terrainPoints.length ? `M ${terrainPoints.join(' L ')}` : '',
      terrainAreaPath,
      terrainLowFidelityPath: lowFidelityPoints.length
        ? `M ${lowFidelityPoints.join(' L ')}`
        : '',
      terrainLowFidelityAreaPath: lowFidelityAreaPath,
      terrainEstimatedPath: estimatedPoints.length
        ? `M ${estimatedPoints.join(' L ')}`
        : '',
      terrainEstimatedAreaPath: estimatedAreaPath,
      groundLinePath: groundPoints.length ? `M ${groundPoints.join(' L ')}` : '',
      conePath: conePoints.length ? `M ${conePoints.join(' L ')}` : '',
      safetySegments: buildSafetyMinAltitudeChartSegments(data, x, y)
    };
  });

  readonly safetyTerrainMarginLabels = computed<SafetyTerrainMarginChartLabel[]>(() => {
    const data = this.samples();
    const g = this.geometry();
    if (data.length === 0) return [];

    const plotW = g.width - g.padding.left - g.padding.right;
    const plotH = g.height - g.padding.top - g.padding.bottom;
    const xKm = (km: number): number =>
      g.padding.left + ((km - g.xMin) / (g.xMax - g.xMin)) * plotW;
    const yM = (m: number): number =>
      g.padding.top + plotH - ((m - g.yMin) / (g.yMax - g.yMin)) * plotH;

    return buildSafetyMinAltitudeTerrainMarginSections(data).map(sec => ({
      key: sec.key,
      x: xKm(sec.peakDistanceKm),
      y: yM(sec.peakSafetyM + SAFETY_MARGIN_LABEL_ALT_OFFSET_M),
      text: sec.label
    }));
  });

  protected readonly safetyTerrainMarginLabelColor = SAFETY_MIN_ALTITUDE_TERRAIN_COLOR;

  readonly hasTerrainQualityIssues = computed(() =>
    this.samples().some(s => s.terrainQuality !== 'dem')
  );

  readonly terrainLowFidelityBands = computed<TerrainEstimatedBand[]>(() =>
    buildQualityBands(this.samples(), this.geometry(), 'dem-low')
  );

  readonly terrainEstimatedBands = computed<TerrainEstimatedBand[]>(() =>
    buildQualityBands(this.samples(), this.geometry(), 'estimated')
  );

  readonly terrainMissingBands = computed<TerrainMissingBand[]>(() =>
    buildQualityBands(this.samples(), this.geometry(), 'missing').map(b => ({
      ...b,
      centerX: b.x + b.width / 2
    }))
  );

  readonly terrainLowFidelityMarks = computed<TerrainEstimatedMark[]>(() =>
    this.qualityMarksFor('dem-low')
  );

  readonly terrainEstimatedMarks = computed<TerrainEstimatedMark[]>(() =>
    this.qualityMarksFor('estimated')
  );

  private qualityMarksFor(
    quality: 'dem-low' | 'estimated'
  ): TerrainEstimatedMark[] {
    const g = this.geometry();
    const data = this.samples();
    const plotW = g.width - g.padding.left - g.padding.right;
    const plotH = g.height - g.padding.top - g.padding.bottom;
    const xKm = (km: number): number =>
      g.padding.left + ((km - g.xMin) / (g.xMax - g.xMin)) * plotW;
    const yM = (m: number): number =>
      g.padding.top + plotH - ((m - g.yMin) / (g.yMax - g.yMin)) * plotH;

    return data
      .filter(s => s.terrainQuality === quality && s.terrainM != null)
      .map(s => ({
        key: `${quality}-${s.distanceKm}`,
        x: xKm(s.distanceKm),
        y: yM(s.terrainM!),
        altitudeM: s.terrainM!
      }));
  }

  readonly airspaceBandDraws = computed<AirspaceBandDraw[]>(() => {
    const g = this.geometry();
    const bands = this.airspaceBands();
    if (bands.length === 0) return [];

    const plotW = g.width - g.padding.left - g.padding.right;
    const plotH = g.height - g.padding.top - g.padding.bottom;
    const xKm = (km: number): number =>
      g.padding.left + ((km - g.xMin) / (g.xMax - g.xMin)) * plotW;
    const yM = (m: number): number =>
      g.padding.top + plotH - ((m - g.yMin) / (g.yMax - g.yMin)) * plotH;

    const hoveredKey = this.hoveredAirspaceZoneKey();
    return bands.map(band => {
      const x0 = xKm(band.alongStartKm);
      const x1 = xKm(band.alongEndKm);
      const yTop = yM(Math.min(band.ceilingM, g.yMax));
      const yBottom = yM(Math.max(band.floorM, g.yMin));
      return {
        key: `${band.key}-${band.alongStartKm}-${band.alongEndKm}`,
        x: Math.min(x0, x1),
        width: Math.max(1, Math.abs(x1 - x0)),
        yTop: Math.min(yTop, yBottom),
        yBottom: Math.max(yTop, yBottom),
        fill: band.fill,
        stroke: '',
        name: band.name,
        hovered: hoveredKey != null && hoveredKey === band.key
      };
    });
  });

  readonly landableLayers = computed<LandableLayerDraw[]>(() => {
    const g = this.geometry();
    const data = this.samples();
    const plotW = g.width - g.padding.left - g.padding.right;
    const plotH = g.height - g.padding.top - g.padding.bottom;
    const xKm = (km: number): number =>
      g.padding.left + ((km - g.xMin) / (g.xMax - g.xMin)) * plotW;
    const yM = (m: number): number =>
      g.padding.top + plotH - ((m - g.yMin) / (g.yMax - g.yMin)) * plotH;
    const plotBottom = g.padding.top + plotH;

    return this.landableCones().map(cone => {
      const coneSegments = buildConeSegments(
        cone.curve,
        data,
        xKm,
        yM
      );

      const markerX = xKm(
        clamp(cone.alongLegKm, g.xMin, g.xMax)
      );
      const markerY = yM(cone.baseAltitudeM);
      const terrainAt = interpolateTerrainM(data, cone.alongLegKm);
      const stemY =
        terrainAt != null ? yM(terrainAt) : plotBottom;
      const stemPath = `M ${markerX},${stemY} L ${markerX},${markerY}`;

      const color = this.landableColor(cone.id);
      return {
        id: cone.id,
        color,
        coneSegments,
        stemPath,
        markerX,
        markerY,
        labelY: markerY - 6,
        label: cone.shortName,
        isBinding: cone.isBinding
      };
    });
  });

  readonly coneIntersections = computed<ConeIntersectionMark[]>(() => {
    const g = this.geometry();
    const data = this.samples();
    const cones = this.landableCones();
    if (cones.length === 0 || data.length === 0) return [];

    const plotW = g.width - g.padding.left - g.padding.right;
    const plotH = g.height - g.padding.top - g.padding.bottom;
    const xKm = (km: number): number =>
      g.padding.left + ((km - g.xMin) / (g.xMax - g.xMin)) * plotW;
    const yM = (m: number): number =>
      g.padding.top + plotH - ((m - g.yMin) / (g.yMax - g.yMin)) * plotH;

    const hits = collectActiveConeCrossings(cones, data, id =>
      this.landableColor(id)
    );
    const raw: Omit<ConeIntersectionMark, 'labelY'>[] = hits.map(hit => ({
      key: hit.key,
      x: xKm(hit.distanceKm),
      y: yM(hit.altitudeM),
      text: formatMetersDisplay(Math.round(hit.altitudeM)),
      color: hit.color
    }));

    return dedupeIntersectionMarks(raw, g.padding.top);
  });

  readonly landablesAtHover = computed<LandableAtHover[]>(() => {
    const hover = this.hoveredSample();
    if (!hover) return [];
    const cones = this.landableCones();
    const atDist = hover.distanceKm;
    const list: LandableAtHover[] = cones.map(cone => {
      const pt =
        cone.curve.find(c => Math.abs(c.distanceKm - atDist) < 0.001) ??
        cone.curve.reduce((best, c) =>
          Math.abs(c.distanceKm - atDist) < Math.abs(best.distanceKm - atDist)
            ? c
            : best
        );
      return {
        name: cone.name,
        shortName: cone.shortName,
        color: this.landableColor(cone.id),
        altitudeM: pt.altitudeM,
        isBinding: cone.id === hover.closestLandableId
      };
    });
    list.sort((a, b) => a.altitudeM - b.altitudeM);
    const bindingAlt = hover.glideConeM;
    if (bindingAlt != null) {
      for (const item of list) {
        item.isBinding = Math.abs(item.altitudeM - bindingAlt) < 2;
      }
    }
    return list;
  });

  readonly xTicks = computed<AxisTick[]>(() => {
    const g = this.geometry();
    const plotW = g.width - g.padding.left - g.padding.right;
    const ticks = niceTicks(g.xMin, g.xMax, 6);
    const last = ticks[ticks.length - 1];
    if (ticks.length > 0 && g.xMax - last > 0.25) {
      ticks.push(g.xMax);
    }
    return ticks.map(value => ({
      value,
      position: g.padding.left + ((value - g.xMin) / (g.xMax - g.xMin)) * plotW,
      label: formatDistanceTick(value)
    }));
  });

  readonly yTicks = computed<AxisTick[]>(() => {
    const g = this.geometry();
    const plotH = g.height - g.padding.top - g.padding.bottom;
    const ticks = niceTicks(g.yMin, g.yMax, 5);
    return ticks.map(value => ({
      value,
      position:
        g.padding.top + plotH - ((value - g.yMin) / (g.yMax - g.yMin)) * plotH,
      label: `${Math.round(value)}`
    }));
  });

  readonly fromMarker = computed(() =>
    this.endpointMarker(this.fromEndpoint(), this.legStartKm())
  );
  readonly toMarker = computed(() => {
    const end =
      this.legEndKm() ??
      (this.samples().length > 0
        ? this.samples()[this.samples().length - 1].distanceKm
        : 0);
    return this.endpointMarker(this.toEndpoint(), end);
  });

  readonly legBounds = computed(() => {
    const g = this.geometry();
    const plotW = g.width - g.padding.left - g.padding.right;
    const xKm = (km: number): number =>
      g.padding.left + ((km - g.xMin) / (g.xMax - g.xMin)) * plotW;
    const start = this.legStartKm();
    const end =
      this.legEndKm() ??
      (this.samples().length > 0
        ? this.samples()[this.samples().length - 1].distanceKm
        : start);
    const yTop = g.padding.top;
    const yBottom = g.height - g.padding.bottom;
    const showStart = start >= g.xMin && start <= g.xMax;
    const showEnd = end >= g.xMin && end <= g.xMax;
    return {
      startX: xKm(start),
      endX: xKm(end),
      yTop,
      yBottom,
      showStart,
      showEnd
    };
  });

  onMouseMove(event: MouseEvent, svg: SVGSVGElement): void {
    const rect = svg.getBoundingClientRect();
    const scaleX = svg.viewBox.baseVal.width / rect.width;
    const xSvg = (event.clientX - rect.left) * scaleX;
    const g = this.geometry();
    const plotW = g.width - g.padding.left - g.padding.right;
    const rel = (xSvg - g.padding.left) / plotW;
    if (rel < 0 || rel > 1) {
      this.hoveredSample.set(null);
      this.sampleHover.emit(null);
      return;
    }
    const km = g.xMin + rel * (g.xMax - g.xMin);
    const data = this.samples();
    if (data.length === 0) {
      this.hoveredSample.set(null);
      this.sampleHover.emit(null);
      return;
    }
    let closest = data[0];
    let best = Math.abs(data[0].distanceKm - km);
    for (const s of data) {
      const d = Math.abs(s.distanceKm - km);
      if (d < best) {
        best = d;
        closest = s;
      }
    }
    this.hoveredSample.set(closest);
    this.sampleHover.emit(closest);
  }

  onMouseLeave(): void {
    this.hoveredSample.set(null);
    this.sampleHover.emit(null);
  }

  tooltipPosition(sample: EnvelopeSample): { x: number; y: number } {
    const g = this.geometry();
    const plotW = g.width - g.padding.left - g.padding.right;
    const plotH = g.height - g.padding.top - g.padding.bottom;
    const x =
      g.padding.left +
      ((sample.distanceKm - g.xMin) / (g.xMax - g.xMin)) * plotW;
    const targetY =
      sample.safetyM ?? sample.terrainM ?? (g.yMin + g.yMax) / 2;
    const y =
      g.padding.top + plotH - ((targetY - g.yMin) / (g.yMax - g.yMin)) * plotH;
    return { x, y };
  }

  formatAltitude(value: number | null): string {
    if (value == null || !Number.isFinite(value)) return '—';
    return formatMetersDisplay(value);
  }

  /** Dimensions fixes pour l'export impression (SVG). */
  setChartSizeForPrint(
    width: number = LEG_PROFILE_PRINT_WIDTH,
    height: number = LEG_PROFILE_PRINT_HEIGHT
  ): void {
    this.chartSize.set({ width, height });
  }

  serializeSvgForPrint(): string | null {
    const host = this.chartHost()?.nativeElement;
    const svg = host?.querySelector('svg.leg-chart__svg');
    if (!svg) return null;
    const { width, height } = this.chartSize();
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
    return new XMLSerializer().serializeToString(clone);
  }

  /** Rasterise le SVG courant en PNG (data URL). */
  async rasterizeSvgForPrint(): Promise<string | null> {
    const svgMarkup = this.serializeSvgForPrint();
    if (!svgMarkup) return null;
    const { width, height } = this.chartSize();
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadChartImage(url);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      return canvas.toDataURL('image/png');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  formatTerrainAltitude(sample: EnvelopeSample): string {
    const lbl = this.labels();
    if (sample.terrainQuality === 'missing') {
      return lbl.tooltipTerrainMissing;
    }
    if (sample.terrainQuality === 'dem-low') {
      return `${this.formatAltitude(sample.terrainM)} (${lbl.terrainLowFidelity})`;
    }
    if (sample.terrainQuality === 'estimated') {
      return `${this.formatAltitude(sample.terrainM)} (${lbl.terrainEstimated})`;
    }
    return this.formatAltitude(sample.terrainM);
  }

  formatDistance(km: number): string {
    return `${km.toFixed(km < 10 ? 1 : 0)} km`;
  }

  private endpointMarker(
    endpoint: LegEndpointInfo,
    distKm: number
  ): {
    x: number;
    yTop: number;
    yBase: number;
    yElev: number;
    name: string;
    elevText: string;
    reserveText: string | null;
  } | null {
    const g = this.geometry();
    const plotW = g.width - g.padding.left - g.padding.right;
    const plotH = g.height - g.padding.top - g.padding.bottom;
    const x = g.padding.left + ((distKm - g.xMin) / (g.xMax - g.xMin)) * plotW;
    const yBase = g.padding.top + plotH;
    const elevM = endpoint.elevationM;
    if (elevM == null) {
      return {
        x,
        yTop: g.padding.top,
        yBase,
        yElev: yBase,
        name: endpoint.name,
        elevText: '—',
        reserveText: null
      };
    }
    const yElev =
      g.padding.top + plotH - ((elevM - g.yMin) / (g.yMax - g.yMin)) * plotH;
    const reserveAlt = elevM + this.arrivalMarginM();
    const yReserve =
      g.padding.top +
      plotH -
      ((reserveAlt - g.yMin) / (g.yMax - g.yMin)) * plotH;
    return {
      x,
      yTop: yReserve,
      yBase,
      yElev,
      name: endpoint.name,
      elevText: `${Math.round(elevM)} m`,
      reserveText: `+${this.arrivalMarginM()} m`
    };
  }
}

interface ConePlotPoint {
  x: number;
  y: number;
  distKm: number;
  altM: number;
  belowMin: boolean;
}

function buildConeSegments(
  curve: LandableConeSample[],
  samples: EnvelopeSample[],
  xKm: (km: number) => number,
  yM: (m: number) => number
): ConePathSegment[] {
  if (curve.length === 0) return [];

  const raw: ConePlotPoint[] = curve.map(pt => {
    const safetyM = interpolateSafetyM(samples, pt.distanceKm);
    const belowMin =
      safetyM != null &&
      Number.isFinite(safetyM) &&
      pt.altitudeM < safetyM - 0.5;
    return {
      x: xKm(pt.distanceKm),
      y: yM(pt.altitudeM),
      distKm: pt.distanceKm,
      altM: pt.altitudeM,
      belowMin
    };
  });

  const expanded: ConePlotPoint[] = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    const prev = raw[i - 1];
    const curr = raw[i];
    if (prev.belowMin !== curr.belowMin) {
      const cross = crossingWithSafety(samples, prev, curr, xKm, yM);
      if (cross) expanded.push(cross);
    }
    expanded.push(curr);
  }

  const segments: ConePathSegment[] = [];
  let run: ConePlotPoint[] = [expanded[0]];

  const flushRun = (): void => {
    if (run.length < 2) return;
    segments.push({
      path: `M ${run.map(p => `${p.x},${p.y}`).join(' L ')}`,
      belowMin: run[0].belowMin
    });
  };

  for (let i = 1; i < expanded.length; i++) {
    const p = expanded[i];
    if (p.belowMin === run[0].belowMin) {
      run.push(p);
    } else {
      flushRun();
      run = [run[run.length - 1], p];
    }
  }
  flushRun();
  return segments;
}

function crossingWithSafety(
  samples: EnvelopeSample[],
  a: ConePlotPoint,
  b: ConePlotPoint,
  xKm: (km: number) => number,
  yM: (m: number) => number
): ConePlotPoint | null {
  const safetyA = interpolateSafetyM(samples, a.distKm);
  const safetyB = interpolateSafetyM(samples, b.distKm);
  if (safetyA == null || safetyB == null) return null;

  const fa = a.altM - safetyA;
  const fb = b.altM - safetyB;
  if (fa * fb >= 0) return null;

  const t = fa / (fa - fb);
  const distKm = a.distKm + t * (b.distKm - a.distKm);
  const altM = a.altM + t * (b.altM - a.altM);
  const safetyM = interpolateSafetyM(samples, distKm) ?? altM;
  return {
    x: xKm(distKm),
    y: yM(altM),
    distKm,
    altM,
    belowMin: altM < safetyM - 0.5
  };
}

function dedupeIntersectionMarks(
  marks: Omit<ConeIntersectionMark, 'labelY'>[],
  plotTop: number
): ConeIntersectionMark[] {
  const kept: ConeIntersectionMark[] = [];
  for (const mark of marks) {
    if (
      kept.some(
        k => Math.abs(k.x - mark.x) < 32 && Math.abs(k.y - mark.y) < 14
      )
    ) {
      continue;
    }
    const stack = kept.filter(k => Math.abs(k.x - mark.x) < 48).length;
    kept.push({
      ...mark,
      labelY: Math.max(plotTop + 6, mark.y - 8 - stack * 11)
    });
  }
  return kept;
}

function interpolateTerrainM(
  samples: EnvelopeSample[],
  alongKm: number
): number | null {
  if (samples.length === 0) return null;
  if (alongKm <= samples[0].distanceKm) return samples[0].terrainM;
  const last = samples[samples.length - 1];
  if (alongKm >= last.distanceKm) return last.terrainM;
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i];
    const b = samples[i + 1];
    if (alongKm >= a.distanceKm && alongKm <= b.distanceKm) {
      if (a.terrainM == null || b.terrainM == null) return a.terrainM ?? b.terrainM;
      const t = (alongKm - a.distanceKm) / (b.distanceKm - a.distanceKm);
      return a.terrainM + t * (b.terrainM - a.terrainM);
    }
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatDistanceTick(km: number): string {
  if (km < 10) return km.toFixed(1);
  return Number.isInteger(km) ? `${km}` : km.toFixed(1);
}

function niceTicks(min: number, max: number, target: number): number[] {
  if (min === max) return [min];
  const range = max - min;
  const rough = range / target;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const candidates = [1, 2, 2.5, 5, 10].map(c => c * pow);
  const step =
    candidates.find(c => range / c <= target * 1.5) ?? candidates[candidates.length - 1];
  const first = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = first; v <= max + 1e-9; v += step) {
    ticks.push(Number(v.toFixed(6)));
  }
  return ticks;
}

function loadChartImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
