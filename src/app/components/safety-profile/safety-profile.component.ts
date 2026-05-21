import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  OnInit,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { MapComponent } from '@maplibre/ngx-maplibre-gl';
import type {
  GeoJSONSource,
  LngLatBoundsLike,
  Map as MaplibreMap,
  StyleSpecification
} from 'maplibre-gl';
import type { FeatureCollection, LineString } from 'geojson';
import { TaskStateService } from '../../services/task-state.service';
import { WaypointService } from '../../services/waypoint.service';
import { TerrainProfileService } from '../../services/terrain-profile.service';
import { GlideEnvelopeService, LegEnvelope } from '../../services/glide-envelope.service';
import {
  DEFAULT_SAFETY_PARAMS,
  SAFETY_PARAMS_BOUNDS,
  SafetyParams
} from '../../models/safety-params.model';
import { CircuitLeg } from '../../models/circuit.model';
import { Waypoint } from '../../models/waypoint.model';
import { TranslateService } from '../../i18n/translate.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import {
  buildBaseMapStyle,
  DEFAULT_BASEMAP_ID,
  MAP_LAYER,
  MAP_SOURCE
} from '../map-view/map-style.constants';
import {
  LegChartLabels,
  LegEndpointInfo,
  LegProfileChartComponent
} from './leg-profile-chart.component';
import { resolveLegElevationM } from '../../utils/elevation.util';
import {
  defaultLegYMaxM,
  landableColorFromId
} from '../../utils/safety-profile-chart.util';

export interface LegLandableToggle {
  id: string;
  name: string;
  shortName: string;
  type: 'airfield' | 'landable';
  color: string;
  enabled: boolean;
}

interface LegRender {
  index: number;
  fromWaypoint: Waypoint;
  toWaypoint: Waypoint;
  fromEndpoint: LegEndpointInfo;
  toEndpoint: LegEndpointInfo;
  distanceKm: number;
  envelope: LegEnvelope;
  landableToggles: LegLandableToggle[];
}

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] };

@Component({
  selector: 'app-safety-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Button,
    InputNumber,
    MapComponent,
    LegProfileChartComponent,
    TranslatePipe
  ],
  templateUrl: './safety-profile.component.html',
  styleUrls: ['./safety-profile.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SafetyProfileComponent implements OnInit, OnDestroy {
  private taskState = inject(TaskStateService);
  private waypointService = inject(WaypointService);
  private terrainProfile = inject(TerrainProfileService);
  private glideEnvelope = inject(GlideEnvelopeService);
  private i18n = inject(TranslateService);
  private router = inject(Router);

  readonly bounds = SAFETY_PARAMS_BOUNDS;
  readonly defaultsParams = DEFAULT_SAFETY_PARAMS;

  // Reactive state mirror of task state, but with local edits for inputs.
  readonly storedParams = this.taskState.safetyParams;
  readonly circuitLegs = this.taskState.circuitLegs;
  readonly waypoints = this.waypointService.waypoints;

  glideRatio = signal<number>(DEFAULT_SAFETY_PARAMS.glideRatio);
  arrivalMarginM = signal<number>(DEFAULT_SAFETY_PARAMS.arrivalMarginM);
  groundMarginM = signal<number>(DEFAULT_SAFETY_PARAMS.groundMarginM);

  mapReady = signal(false);
  mapStyle: StyleSpecification = buildBaseMapStyle(DEFAULT_BASEMAP_ID, true);
  mapCenter = signal<[number, number]>([6.5, 46.5]);
  mapZoom = signal<[number]>([6]);
  profilesLoading = signal(false);
  profilesVersion = signal(0);
  collapsedLegs = signal<Set<number>>(new Set());
  /** Altitude max (échelle verticale) par branche ; absent = défaut relief. */
  legYMaxOverrides = signal<Record<number, number>>({});

  private map: MaplibreMap | null = null;
  private idleHandler: (() => void) | null = null;
  private styleLoadedHandler: (() => void) | null = null;
  private idleRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private lastProfileHash = '';

  readonly currentParams = computed<SafetyParams>(() => ({
    glideRatio: this.glideRatio(),
    arrivalMarginM: this.arrivalMarginM(),
    groundMarginM: this.groundMarginM()
  }));

  readonly legPairs = computed<{
    fromLeg: CircuitLeg;
    toLeg: CircuitLeg;
    from: Waypoint;
    to: Waypoint;
  }[]>(() => {
    const legs = this.circuitLegs();
    if (legs.length < 2) return [];
    const pairs: {
      fromLeg: CircuitLeg;
      toLeg: CircuitLeg;
      from: Waypoint;
      to: Waypoint;
    }[] = [];
    for (let i = 0; i < legs.length - 1; i++) {
      const from = this.waypointService.getWaypoint(legs[i].waypointId);
      const to = this.waypointService.getWaypoint(legs[i + 1].waypointId);
      if (from && to) {
        pairs.push({ fromLeg: legs[i], toLeg: legs[i + 1], from, to });
      }
    }
    return pairs;
  });

  readonly landables = computed<Waypoint[]>(() =>
    this.waypoints().filter(wp => wp.type === 'airfield' || wp.type === 'landable')
  );

  readonly hasTask = computed(() => this.legPairs().length > 0);
  readonly noLandables = computed(() => this.landables().length === 0);

  readonly chartLabels = computed<LegChartLabels>(() => {
    this.i18n.locale();
    return {
      terrain: this.i18n.t('safetyProfile.chart.terrain'),
      groundClearance: this.i18n.t('safetyProfile.chart.groundClearance'),
      glideCone: this.i18n.t('safetyProfile.chart.glideCone'),
      safety: this.i18n.t('safetyProfile.chart.safety'),
      distance: this.i18n.t('safetyProfile.chart.distanceAxis'),
      altitude: this.i18n.t('safetyProfile.chart.altitudeAxis'),
      noLandables: this.i18n.t('safetyProfile.warnings.noLandables'),
      tooltipDistance: this.i18n.t('safetyProfile.chart.tooltipDistance'),
      tooltipTerrain: this.i18n.t('safetyProfile.chart.tooltipTerrain'),
      tooltipCone: this.i18n.t('safetyProfile.chart.tooltipCone'),
      tooltipGround: this.i18n.t('safetyProfile.chart.tooltipGround'),
      tooltipSafety: this.i18n.t('safetyProfile.chart.tooltipSafety'),
      landableColors: this.i18n.t('safetyProfile.chart.landableColors'),
      landableConeBelowMin: this.i18n.t('safetyProfile.chart.landableConeBelowMin'),
      tooltipLandablesTitle: this.i18n.t('safetyProfile.chart.tooltipLandablesTitle'),
      tooltipLandableAt: this.i18n.t('safetyProfile.chart.tooltipLandableAt'),
      conesTruncated: this.i18n.t('safetyProfile.chart.conesTruncated')
    };
  });

  readonly legRenders = signal<LegRender[]>([]);

  constructor() {
    // Sync local signals with persisted params (when task is loaded externally).
    effect(() => {
      const persisted = this.storedParams();
      this.glideRatio.set(persisted.glideRatio);
      this.arrivalMarginM.set(persisted.arrivalMarginM);
      this.groundMarginM.set(persisted.groundMarginM);
    });

    // Trigger profile recomputation when params or task change and map is ready.
    effect(() => {
      this.currentParams();
      this.circuitLegs();
      this.profilesVersion();
      this.landables();
      if (this.mapReady()) {
        this.refreshProfiles();
      }
    });
  }

  ngOnInit(): void {
    const pairs = this.legPairs();
    if (pairs.length > 0) {
      const lng = pairs[0].from.longitude;
      const lat = pairs[0].from.latitude;
      this.mapCenter.set([lng, lat]);
      this.mapZoom.set([8]);
    }
  }

  ngOnDestroy(): void {
    this.terrainProfile.setMap(null);
    if (this.idleRefreshTimer) clearTimeout(this.idleRefreshTimer);
    if (this.map) {
      if (this.idleHandler) this.map.off('idle', this.idleHandler);
      if (this.styleLoadedHandler) this.map.off('styledata', this.styleLoadedHandler);
    }
    this.map = null;
  }

  onMapLoad(map: MaplibreMap): void {
    this.map = map;
    this.terrainProfile.setMap(map);
    map.addSource(MAP_SOURCE.TASK_LINES, { type: 'geojson', data: EMPTY_FC });
    map.addLayer({
      id: MAP_LAYER.TASK_LINES,
      type: 'line',
      source: MAP_SOURCE.TASK_LINES,
      paint: {
        'line-color': '#fbbf24',
        'line-width': 4,
        'line-opacity': 0.9
      }
    });
    this.updateTaskLines();
    this.fitToTask();

    this.idleHandler = () => {
      if (this.idleRefreshTimer) return;
      this.idleRefreshTimer = setTimeout(() => {
        this.idleRefreshTimer = null;
        this.profilesVersion.update(v => v + 1);
      }, 600);
    };
    map.on('idle', this.idleHandler);

    requestAnimationFrame(() => {
      map.resize();
      this.fitToTask();
    });

    this.mapReady.set(true);
    this.refreshProfiles();
  }

  onGlideRatioChange(value: number | null | undefined): void {
    if (value == null || !Number.isFinite(value)) return;
    this.glideRatio.set(value);
    this.taskState.setSafetyParams({ glideRatio: value });
    this.terrainProfile.clearCache();
    this.lastProfileHash = '';
  }

  onArrivalMarginChange(value: number | null | undefined): void {
    if (value == null || !Number.isFinite(value)) return;
    this.arrivalMarginM.set(value);
    this.taskState.setSafetyParams({ arrivalMarginM: value });
    this.lastProfileHash = '';
  }

  onGroundMarginChange(value: number | null | undefined): void {
    if (value == null || !Number.isFinite(value)) return;
    this.groundMarginM.set(value);
    this.taskState.setSafetyParams({ groundMarginM: value });
    this.lastProfileHash = '';
  }

  onResetDefaults(): void {
    this.taskState.resetSafetyParams();
    this.terrainProfile.clearCache();
    this.lastProfileHash = '';
  }

  toggleLeg(index: number): void {
    this.collapsedLegs.update(set => {
      const next = new Set(set);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  isLegCollapsed(index: number): boolean {
    return this.collapsedLegs().has(index);
  }

  collapseAll(): void {
    const indices = this.legRenders().map(l => l.index);
    this.collapsedLegs.set(new Set(indices));
  }

  expandAll(): void {
    this.collapsedLegs.set(new Set());
  }

  defaultYMaxForLeg(leg: LegRender): number {
    return defaultLegYMaxM(leg.envelope.samples);
  }

  effectiveYMaxForLeg(leg: LegRender): number {
    const override = this.legYMaxOverrides()[leg.index];
    if (override != null && Number.isFinite(override)) return override;
    return this.defaultYMaxForLeg(leg);
  }

  isYMaxCustom(legIndex: number): boolean {
    return this.legYMaxOverrides()[legIndex] != null;
  }

  onLegYMaxChange(legIndex: number, value: number | null | undefined): void {
    if (value == null || !Number.isFinite(value)) return;
    const clamped = Math.max(500, Math.round(value));
    this.legYMaxOverrides.update(m => ({ ...m, [legIndex]: clamped }));
  }

  resetLegYMax(legIndex: number, event?: Event): void {
    event?.stopPropagation();
    this.legYMaxOverrides.update(m => {
      const { [legIndex]: _removed, ...rest } = m;
      return rest;
    });
  }

  onLandableToggle(
    branchIndex: number,
    landableId: string,
    enabled: boolean
  ): void {
    this.lastProfileHash = '';
    this.taskState.setSafetyLandableEnabled(branchIndex, landableId, enabled);
  }

  enableAllLandablesOnLeg(leg: LegRender, event?: Event): void {
    event?.stopPropagation();
    this.lastProfileHash = '';
    this.taskState.setAllSafetyLandablesEnabled(
      leg.index,
      leg.landableToggles.map(t => t.id),
      true
    );
  }

  disableAllLandablesOnLeg(leg: LegRender, event?: Event): void {
    event?.stopPropagation();
    this.lastProfileHash = '';
    this.taskState.setAllSafetyLandablesEnabled(
      leg.index,
      leg.landableToggles.map(t => t.id),
      false
    );
  }

  enabledLandableCount(leg: LegRender): number {
    return leg.landableToggles.filter(t => t.enabled).length;
  }

  goToCircuit(): void {
    void this.router.navigate(['/declaration']);
  }

  private updateTaskLines(): void {
    const map = this.map;
    if (!map) return;
    const pairs = this.legPairs();
    const features = pairs.map(p => ({
      type: 'Feature' as const,
      properties: { legIndex: p.toLeg.waypointId },
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [p.from.longitude, p.from.latitude],
          [p.to.longitude, p.to.latitude]
        ]
      } satisfies LineString
    }));
    const fc: FeatureCollection = { type: 'FeatureCollection', features };
    const source = map.getSource(MAP_SOURCE.TASK_LINES);
    if (source && source.type === 'geojson') {
      (source as GeoJSONSource).setData(fc);
    }
  }

  private fitToTask(): void {
    const map = this.map;
    if (!map) return;
    const pairs = this.legPairs();
    if (pairs.length === 0) return;
    const lngs: number[] = [];
    const lats: number[] = [];
    for (const p of pairs) {
      lngs.push(p.from.longitude, p.to.longitude);
      lats.push(p.from.latitude, p.to.latitude);
    }
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const bounds: LngLatBoundsLike = [
      [minLng, minLat],
      [maxLng, maxLat]
    ];
    try {
      map.fitBounds(bounds, { padding: 40, duration: 0, maxZoom: 11 });
    } catch {
      /* invalid bounds (single point) — ignore */
    }
  }

  private refreshProfiles(): void {
    const pairs = this.legPairs();
    const params = this.currentParams();
    const landables = this.landables();
    if (pairs.length === 0) {
      this.legRenders.set([]);
      return;
    }
    const renders: LegRender[] = pairs.map((pair, idx) => {
      const fromLngLat: [number, number] = [
        pair.from.longitude,
        pair.from.latitude
      ];
      const toLngLat: [number, number] = [pair.to.longitude, pair.to.latitude];
      const legGeo = {
        fromLng: pair.from.longitude,
        fromLat: pair.from.latitude,
        toLng: pair.to.longitude,
        toLat: pair.to.latitude
      };
      const fromElev = resolveLegElevationM(pair.from, pair.fromLeg);
      const toElev = resolveLegElevationM(pair.to, pair.toLeg);
      const endpoints = {
        fromElevationM: fromElev ?? null,
        toElevationM: toElev ?? null
      };

      const initial = this.terrainProfile.sampleLegProfile(fromLngLat, toLngLat);
      const disabledSet = new Set(
        pair.fromLeg.safetyOutgoing?.disabledLandableIds ?? []
      );
      const intersecting = this.glideEnvelope.filterIntersectingLandables(
        landables,
        params,
        legGeo,
        endpoints,
        initial.totalDistanceKm,
        initial.samples
      );
      const activeLandables = intersecting.filter(la => !disabledSet.has(la.id));

      const extentActive = this.glideEnvelope.computeProfileExtent(
        initial.totalDistanceKm,
        activeLandables,
        params,
        legGeo,
        endpoints,
        initial.samples
      );
      const profile =
        extentActive.startKm < 0 ||
        extentActive.endKm > initial.totalDistanceKm
          ? this.terrainProfile.sampleLegRange(
              fromLngLat,
              toLngLat,
              extentActive.startKm,
              extentActive.endKm
            )
          : initial;
      const envelope = this.glideEnvelope.computeLegEnvelope(
        profile.samples,
        activeLandables,
        params,
        legGeo,
        endpoints,
        initial.totalDistanceKm
      );

      const landableToggles: LegLandableToggle[] = intersecting.map(la => ({
        id: la.id,
        name: la.name,
        shortName: la.code?.trim() || la.name,
        type: la.type === 'airfield' ? 'airfield' : 'landable',
        color: landableColorFromId(la.id),
        enabled: !disabledSet.has(la.id)
      }));

      return {
        index: idx,
        fromWaypoint: pair.from,
        toWaypoint: pair.to,
        fromEndpoint: {
          name: pair.from.name,
          elevationM: fromElev ?? null
        },
        toEndpoint: {
          name: pair.to.name,
          elevationM: toElev ?? null
        },
        distanceKm: profile.totalDistanceKm,
        envelope,
        landableToggles
      };
    });
    const hash = renders
      .map(r => {
        const terrain = r.envelope.samples
          .map(s => (s.terrainM != null ? Math.round(s.terrainM) : 'x'))
          .join(',');
        const disabled = r.landableToggles
          .filter(t => !t.enabled)
          .map(t => t.id)
          .join(',');
        return `${terrain}|${disabled}`;
      })
      .join('||');
    if (hash === this.lastProfileHash) return;
    this.lastProfileHash = hash;

    this.legRenders.set(renders);
    this.profilesLoading.set(false);
  }
}
