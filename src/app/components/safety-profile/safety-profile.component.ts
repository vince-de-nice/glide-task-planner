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
  MapLayerMouseEvent,
  StyleSpecification
} from 'maplibre-gl';
import type { FeatureCollection, LineString, Point } from 'geojson';
import { TaskStateService } from '../../services/task-state.service';
import { WaypointService } from '../../services/waypoint.service';
import { TerrainProfileService } from '../../services/terrain-profile.service';
import {
  GlideEnvelopeService,
  LegEnvelope,
  type EnvelopeSample
} from '../../services/glide-envelope.service';
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
  applyBasemapToMap,
  BASEMAP_PRESETS,
  buildBaseMapStyle,
  DEFAULT_BASEMAP_ID,
  isBasemapId,
  MAP_BASEMAP_STORAGE_KEY,
  type BasemapId
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
import { buildProfileLegPointsGeoJson } from '../../utils/safety-cone-map-geojson.util';
import {
  buildSafetyConeMeshSpecs,
  coneTopAltitudeM,
  createSafetyConeCustomLayer,
  SAFETY_CONES_CUSTOM_LAYER_ID,
  type SafetyConeThreeCustomLayer
} from '../../utils/safety-cone-three-layer.util';

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

/** Sources / calques carte dédiés à l’écran profil de sécurité. */
const PROFILE_MAP_SOURCE = {
  BRANCHES: 'safety-profile-branches',
  POINTS: 'safety-profile-points',
  CURSOR: 'safety-profile-cursor',
  CURSOR_TRACK: 'safety-profile-cursor-track'
} as const;

const PROFILE_MAP_LAYER = {
  BRANCHES: 'safety-profile-branches',
  BRANCHES_HIT: 'safety-profile-branches-hit',
  POINTS: 'safety-profile-points',
  POINT_LABELS: 'safety-profile-point-labels',
  CURSOR_TRACK: 'safety-profile-cursor-track',
  CURSOR_POINT: 'safety-profile-cursor-point'
} as const;

/** Ordre de superposition des calques métier (bas → haut). */
const PROFILE_LAYER_STACK: readonly string[] = [
  SAFETY_CONES_CUSTOM_LAYER_ID,
  PROFILE_MAP_LAYER.BRANCHES_HIT,
  PROFILE_MAP_LAYER.BRANCHES,
  PROFILE_MAP_LAYER.POINTS,
  PROFILE_MAP_LAYER.POINT_LABELS,
  PROFILE_MAP_LAYER.CURSOR_TRACK,
  PROFILE_MAP_LAYER.CURSOR_POINT
];

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
  readonly basemapId = signal<BasemapId>(DEFAULT_BASEMAP_ID);
  basemapPanelExpanded = signal(false);
  /** Volumes 3D des cônes de demi-finesse sur la carte (branche active). */
  cones3dVisible = signal(true);
  /** Style initial — les changements de fond passent par applyBasemapToMap. */
  mapStyle: StyleSpecification = buildBaseMapStyle(DEFAULT_BASEMAP_ID, true);
  mapCenter = signal<[number, number]>([6.5, 46.5]);
  mapZoom = signal<[number]>([6]);
  profilesLoading = signal(false);
  profilesVersion = signal(0);
  /** Branche affichée dans la coupe (index 0…n-1). */
  selectedLegIndex = signal(0);
  paramsPanelOpen = signal(false);
  /** Altitude max (échelle verticale) par branche ; absent = défaut relief. */
  legYMaxOverrides = signal<Record<number, number>>({});

  private map: MaplibreMap | null = null;
  /** Première couche métier (ancrage pour changement de fond). */
  private dataLayerAnchorId: string | null = null;
  private idleHandler: (() => void) | null = null;
  private idleRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private branchClickHandler: ((e: MapLayerMouseEvent) => void) | null = null;
  private branchEnterHandler: (() => void) | null = null;
  private branchLeaveHandler: (() => void) | null = null;
  private safetyConesLayer: SafetyConeThreeCustomLayer | null = null;
  private lastProfileHash = '';
  readonly profileMapCursor = signal<{
    legIndex: number;
    longitude: number;
    latitude: number;
    distanceKm: number;
  } | null>(null);

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
      coneIntersectionAltitude: this.i18n.t('safetyProfile.chart.coneIntersectionAltitude'),
      tooltipLandablesTitle: this.i18n.t('safetyProfile.chart.tooltipLandablesTitle'),
      tooltipLandableAt: this.i18n.t('safetyProfile.chart.tooltipLandableAt'),
      conesTruncated: this.i18n.t('safetyProfile.chart.conesTruncated')
    };
  });

  readonly legRenders = signal<LegRender[]>([]);

  readonly activeLegRender = computed(() => {
    const renders = this.legRenders();
    const idx = this.selectedLegIndex();
    return renders.find(l => l.index === idx) ?? renders[0] ?? null;
  });

  readonly basemapOptions = computed(() => {
    this.i18n.locale();
    return BASEMAP_PRESETS.map(p => ({
      id: p.id,
      icon: p.icon,
      label: this.i18n.t(p.labelKey)
    }));
  });

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

    effect(() => {
      this.selectedLegIndex();
      this.legRenders();
      if (this.mapReady()) {
        this.updateBranchLines();
      }
    });

    effect(() => {
      this.activeLegRender();
      this.cones3dVisible();
      this.currentParams();
      if (this.mapReady()) {
        this.updateSafetyCones3d();
        this.updateProfileMapPoints();
      }
    });
  }

  ngOnInit(): void {
    const storedBasemap = localStorage.getItem(MAP_BASEMAP_STORAGE_KEY);
    if (storedBasemap && isBasemapId(storedBasemap)) {
      this.basemapId.set(storedBasemap);
      this.mapStyle = buildBaseMapStyle(storedBasemap, true);
    }

    const pairs = this.legPairs();
    if (pairs.length > 0) {
      const lng = pairs[0].from.longitude;
      const lat = pairs[0].from.latitude;
      this.mapCenter.set([lng, lat]);
      this.mapZoom.set([8]);
    }
  }

  ngOnDestroy(): void {
    this.profileMapCursor.set(null);
    this.terrainProfile.setMap(null);
    if (this.idleRefreshTimer) clearTimeout(this.idleRefreshTimer);
    if (this.map) {
      if (this.idleHandler) this.map.off('idle', this.idleHandler);
      if (this.branchClickHandler) {
        this.map.off('click', PROFILE_MAP_LAYER.BRANCHES_HIT, this.branchClickHandler);
      }
      if (this.branchEnterHandler) {
        this.map.off('mouseenter', PROFILE_MAP_LAYER.BRANCHES_HIT, this.branchEnterHandler);
      }
      if (this.branchLeaveHandler) {
        this.map.off('mouseleave', PROFILE_MAP_LAYER.BRANCHES_HIT, this.branchLeaveHandler);
      }
      if (this.map.getLayer(SAFETY_CONES_CUSTOM_LAYER_ID)) {
        this.map.removeLayer(SAFETY_CONES_CUSTOM_LAYER_ID);
      }
    }
    this.safetyConesLayer = null;
    this.map = null;
  }

  toggleBasemapPanel(): void {
    this.basemapPanelExpanded.update(v => !v);
  }

  toggleCones3d(): void {
    this.cones3dVisible.update(v => !v);
    this.updateSafetyCones3d();
    this.fitToActiveLeg();
  }

  selectBasemap(id: BasemapId): void {
    if (id === this.basemapId()) {
      this.basemapPanelExpanded.set(false);
      return;
    }
    this.basemapId.set(id);
    localStorage.setItem(MAP_BASEMAP_STORAGE_KEY, id);
    const map = this.map;
    const anchor = this.dataLayerAnchorId;
    if (map && anchor) {
      applyBasemapToMap(map, id, anchor);
      this.repositionProfileMapLayers();
      this.updateSafetyCones3d();
      this.updateProfileMapPoints();
    }
    this.basemapPanelExpanded.set(false);
  }

  onMapLoad(map: MaplibreMap): void {
    this.map = map;
    this.terrainProfile.setMap(map);
    this.dataLayerAnchorId = SAFETY_CONES_CUSTOM_LAYER_ID;

    this.safetyConesLayer = createSafetyConeCustomLayer();
    map.addLayer(this.safetyConesLayer);

    map.addSource(PROFILE_MAP_SOURCE.POINTS, { type: 'geojson', data: EMPTY_FC });
    map.addLayer({
      id: PROFILE_MAP_LAYER.POINTS,
      type: 'circle',
      source: PROFILE_MAP_SOURCE.POINTS,
      paint: {
        'circle-radius': [
          'match',
          ['get', 'role'],
          'from',
          10,
          'to',
          10,
          'landable',
          9,
          8
        ],
        'circle-color': ['get', 'color'],
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 1
      }
    });
    map.addLayer({
      id: PROFILE_MAP_LAYER.POINT_LABELS,
      type: 'symbol',
      source: PROFILE_MAP_SOURCE.POINTS,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 11,
        'text-offset': [0, 1.35],
        'text-anchor': 'top',
        'text-max-width': 10,
        'text-optional': true
      },
      paint: {
        'text-color': ['get', 'color'],
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.75
      }
    });

    map.addSource(PROFILE_MAP_SOURCE.BRANCHES, { type: 'geojson', data: EMPTY_FC });
    map.addLayer({
      id: PROFILE_MAP_LAYER.BRANCHES_HIT,
      type: 'line',
      source: PROFILE_MAP_SOURCE.BRANCHES,
      paint: { 'line-width': 14, 'line-opacity': 0 }
    });
    map.addLayer({
      id: PROFILE_MAP_LAYER.BRANCHES,
      type: 'line',
      source: PROFILE_MAP_SOURCE.BRANCHES,
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'selected'], true],
          '#f97316',
          '#fbbf24'
        ],
        'line-width': [
          'case',
          ['==', ['get', 'selected'], true],
          6,
          3
        ],
        'line-opacity': [
          'case',
          ['==', ['get', 'selected'], true],
          1,
          0.55
        ]
      }
    });
    map.addSource(PROFILE_MAP_SOURCE.CURSOR_TRACK, {
      type: 'geojson',
      data: EMPTY_FC
    });
    map.addSource(PROFILE_MAP_SOURCE.CURSOR, {
      type: 'geojson',
      data: EMPTY_FC
    });
    map.addLayer({
      id: PROFILE_MAP_LAYER.CURSOR_TRACK,
      type: 'line',
      source: PROFILE_MAP_SOURCE.CURSOR_TRACK,
      paint: {
        'line-color': '#f97316',
        'line-width': 5,
        'line-opacity': 0.9
      }
    });
    map.addLayer({
      id: PROFILE_MAP_LAYER.CURSOR_POINT,
      type: 'circle',
      source: PROFILE_MAP_SOURCE.CURSOR,
      paint: {
        'circle-radius': 9,
        'circle-color': '#ffffff',
        'circle-stroke-width': 3,
        'circle-stroke-color': '#dc2626',
        'circle-opacity': 1
      }
    });
    this.branchClickHandler = (e: MapLayerMouseEvent) => {
      const feat = e.features?.[0];
      if (!feat?.properties) return;
      const raw = feat.properties['legIndex'];
      const idx =
        typeof raw === 'number' ? raw : typeof raw === 'string' ? parseInt(raw, 10) : NaN;
      if (Number.isFinite(idx)) this.selectLeg(idx);
    };
    this.branchEnterHandler = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    this.branchLeaveHandler = () => {
      map.getCanvas().style.cursor = '';
    };
    map.on('click', PROFILE_MAP_LAYER.BRANCHES_HIT, this.branchClickHandler);
    map.on('mouseenter', PROFILE_MAP_LAYER.BRANCHES_HIT, this.branchEnterHandler);
    map.on('mouseleave', PROFILE_MAP_LAYER.BRANCHES_HIT, this.branchLeaveHandler);

    this.repositionProfileMapLayers();
    this.updateBranchLines();
    this.updateSafetyCones3d();
    this.updateProfileMapPoints();
    this.fitToActiveLeg();

    this.idleHandler = () => {
      if (this.idleRefreshTimer) return;
      this.idleRefreshTimer = setTimeout(() => {
        this.idleRefreshTimer = null;
        this.profilesVersion.update(v => v + 1);
      }, 600);
    };
    map.on('idle', this.idleHandler);
    map.setMinPitch(0);
    map.setMaxPitch(85);

    requestAnimationFrame(() => {
      map.resize();
      this.fitToActiveLeg();
    });

    map.once('idle', () => {
      this.updateSafetyCones3d();
      this.updateProfileMapPoints();
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

  toggleParamsPanel(): void {
    this.paramsPanelOpen.update(open => !open);
  }

  closeParamsPanel(): void {
    this.paramsPanelOpen.set(false);
  }

  selectLeg(index: number): void {
    const renders = this.legRenders();
    if (!renders.some(l => l.index === index)) return;
    if (index === this.selectedLegIndex()) return;
    this.selectedLegIndex.set(index);
    const cursor = this.profileMapCursor();
    if (cursor && cursor.legIndex !== index) {
      this.profileMapCursor.set(null);
      this.syncProfileMapCursor();
    }
    this.updateSafetyCones3d();
    this.updateProfileMapPoints();
    this.fitToActiveLeg();
  }

  selectPrevLeg(): void {
    this.selectLeg(this.selectedLegIndex() - 1);
  }

  selectNextLeg(): void {
    this.selectLeg(this.selectedLegIndex() + 1);
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

  onChartSampleHover(legIndex: number, sample: EnvelopeSample | null): void {
    if (sample == null) {
      this.profileMapCursor.set(null);
    } else {
      this.profileMapCursor.set({
        legIndex,
        longitude: sample.longitude,
        latitude: sample.latitude,
        distanceKm: sample.distanceKm
      });
    }
    this.syncProfileMapCursor();
  }

  goToCircuit(): void {
    void this.router.navigate(['/declaration']);
  }

  private syncProfileMapCursor(): void {
    const map = this.map;
    if (!map) return;

    const pointSource = map.getSource(PROFILE_MAP_SOURCE.CURSOR);
    const trackSource = map.getSource(PROFILE_MAP_SOURCE.CURSOR_TRACK);
    if (
      !pointSource ||
      pointSource.type !== 'geojson' ||
      !trackSource ||
      trackSource.type !== 'geojson'
    ) {
      return;
    }

    const cursor = this.profileMapCursor();
    if (!cursor) {
      (pointSource as GeoJSONSource).setData(EMPTY_FC);
      (trackSource as GeoJSONSource).setData(EMPTY_FC);
      return;
    }

    const leg = this.legRenders().find(l => l.index === cursor.legIndex);
    if (!leg) {
      (pointSource as GeoJSONSource).setData(EMPTY_FC);
      (trackSource as GeoJSONSource).setData(EMPTY_FC);
      return;
    }

    const pointFc: FeatureCollection<Point> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { distanceKm: cursor.distanceKm },
          geometry: {
            type: 'Point',
            coordinates: [cursor.longitude, cursor.latitude]
          }
        }
      ]
    };

    const trackCoords: [number, number][] = [
      [leg.fromWaypoint.longitude, leg.fromWaypoint.latitude],
      [cursor.longitude, cursor.latitude]
    ];
    const trackFc: FeatureCollection<LineString> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: trackCoords }
        }
      ]
    };

    (pointSource as GeoJSONSource).setData(pointFc);
    (trackSource as GeoJSONSource).setData(trackFc);
  }

  private repositionProfileMapLayers(): void {
    const map = this.map;
    if (!map) return;
    for (const layerId of PROFILE_LAYER_STACK) {
      if (map.getLayer(layerId)) {
        map.moveLayer(layerId);
      }
    }
  }

  private updateProfileMapPoints(): void {
    const map = this.map;
    if (!map) return;
    const source = map.getSource(PROFILE_MAP_SOURCE.POINTS);
    if (!source || source.type !== 'geojson') return;

    const leg = this.activeLegRender();
    if (!leg) {
      (source as GeoJSONSource).setData(EMPTY_FC);
      return;
    }

    const landables = leg.landableToggles
      .filter(t => t.enabled)
      .flatMap(t => {
        const wp = this.waypointService.getWaypoint(t.id);
        if (!wp) return [];
        return [
          {
            id: t.id,
            role: 'landable' as const,
            longitude: wp.longitude,
            latitude: wp.latitude,
            label: t.shortName,
            color: t.color
          }
        ];
      });

    const fc = buildProfileLegPointsGeoJson({
      from: {
        longitude: leg.fromWaypoint.longitude,
        latitude: leg.fromWaypoint.latitude,
        name: leg.fromWaypoint.name
      },
      to: {
        longitude: leg.toWaypoint.longitude,
        latitude: leg.toWaypoint.latitude,
        name: leg.toWaypoint.name
      },
      landables
    });
    (source as GeoJSONSource).setData(fc);
    this.repositionProfileMapLayers();
  }

  private updateSafetyCones3d(): void {
    const layer = this.safetyConesLayer;
    if (!layer) return;

    const leg = this.activeLegRender();
    if (!this.cones3dVisible() || !leg) {
      layer.setSpecs([]);
      layer.setVisible(false);
      return;
    }

    const enabledIds = new Set(
      leg.landableToggles.filter(t => t.enabled).map(t => t.id)
    );
    const enabledCones = leg.envelope.landableCones.filter(c =>
      enabledIds.has(c.id)
    );

    const apexMap = new Map<string, [number, number]>();
    for (const cone of enabledCones) {
      const wp = this.waypointService.getWaypoint(cone.id);
      if (wp) {
        apexMap.set(cone.id, [wp.longitude, wp.latitude]);
      }
    }

    const halfRatio = Math.max(1, this.glideRatio() / 2);
    const specs = buildSafetyConeMeshSpecs({
      landableCones: enabledCones,
      halfRatio,
      landableApexLngLat: apexMap
    });

    layer.setSpecs(specs);
    layer.setVisible(specs.length > 0);
    this.repositionProfileMapLayers();
    this.map?.triggerRepaint();
  }

  private fitToActiveLeg(): void {
    const map = this.map;
    const leg = this.activeLegRender();
    if (!map || !leg) return;

    const cones3d = this.cones3dVisible();
    const enabledLandables = leg.landableToggles
      .filter(t => t.enabled)
      .flatMap(t => {
        const wp = this.waypointService.getWaypoint(t.id);
        return wp ? [wp] : [];
      });

    const lngs: number[] = [];
    const lats: number[] = [];

    if (cones3d && enabledLandables.length > 0) {
      /*
       * En mode 3D : centrer sur les terrains posables actifs et inclure
       * le rayon de la base du cône le plus grand pour montrer la forme conique.
       * baseRadius (km) = (yMaxM - min(baseAltitudeM)) * halfRatio / 1000.
       */
      const halfRatio = Math.max(1, this.glideRatio() / 2);
      let maxBaseRadiusKm = 2;

      for (const cone of leg.envelope.landableCones.filter(c =>
        leg.landableToggles.some(t => t.id === c.id && t.enabled)
      )) {
        /* Rayon de la base = (altitude max de la courbe - tip) * halfRatio / 1000
           Pas de terrain dans ce calcul — c'est la géométrie pure du cône. */
        const topAlt = coneTopAltitudeM(cone);
        const r = ((topAlt - cone.baseAltitudeM) * halfRatio) / 1000;
        if (r > maxBaseRadiusKm) maxBaseRadiusKm = r;
      }

      /* Rayon converti approximativement en degrés (1° ≈ 111 km). */
      const degOffset = maxBaseRadiusKm / 90; // légèrement supérieur à /111 pour une marge

      for (const wp of enabledLandables) {
        lngs.push(wp.longitude - degOffset, wp.longitude + degOffset);
        lats.push(wp.latitude - degOffset, wp.latitude + degOffset);
      }
    } else {
      lngs.push(leg.fromWaypoint.longitude, leg.toWaypoint.longitude);
      lats.push(leg.fromWaypoint.latitude, leg.toWaypoint.latitude);
      for (const s of leg.envelope.samples) {
        lngs.push(s.longitude);
        lats.push(s.latitude);
      }
    }

    const bounds: LngLatBoundsLike = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)]
    ];

    try {
      const cam = map.cameraForBounds(bounds, {
        padding: 40,
        maxZoom: cones3d ? 10 : 13
      });
      if (!cam) return;

      /* Ne pas imposer pitch/bearing : l'utilisateur règle l'inclinaison à la souris. */
      map.easeTo({
        center: cam.center,
        zoom: cam.zoom,
        bearing: map.getBearing(),
        pitch: map.getPitch(),
        duration: 700
      });
    } catch {
      /* bounds invalides */
    }
  }

  private updateBranchLines(): void {
    const map = this.map;
    if (!map) return;
    const pairs = this.legPairs();
    const selected = this.selectedLegIndex();
    const features = pairs.map((p, idx) => ({
      type: 'Feature' as const,
      properties: { legIndex: idx, selected: idx === selected },
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [p.from.longitude, p.from.latitude],
          [p.to.longitude, p.to.latitude]
        ]
      } satisfies LineString
    }));
    const fc: FeatureCollection = { type: 'FeatureCollection', features };
    const source = map.getSource(PROFILE_MAP_SOURCE.BRANCHES);
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

    const selected = this.selectedLegIndex();
    if (renders.length > 0 && !renders.some(r => r.index === selected)) {
      this.selectedLegIndex.set(renders[0].index);
    }

    this.legRenders.set(renders);
    this.profilesLoading.set(false);
    this.updateBranchLines();
    this.updateSafetyCones3d();
    this.updateProfileMapPoints();
  }
}
