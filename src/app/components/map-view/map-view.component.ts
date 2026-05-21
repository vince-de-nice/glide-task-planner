import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  OnInit,
  effect,
  signal
} from '@angular/core';
import { TranslateService } from '../../i18n/translate.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import {
  circuitRoleShortLabelI18n,
  mapPopupLabels,
  waypointTypeDisplayI18n
} from '../../i18n/display-i18n.util';
import { WAYPOINT_TYPE_ORDER } from '../../utils/waypoint-type-display.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapComponent } from '@maplibre/ngx-maplibre-gl';
import {
  Popup,
  type GeoJSONSource,
  type Map as MaplibreMap,
  type MapLayerMouseEvent,
  type MapMouseEvent
} from 'maplibre-gl';
import type { Feature, FeatureCollection, Geometry, Point } from 'geojson';
import type { PoaffProperties } from '../../services/airspace-layer.service';
import { extendBoundsWithShape } from '../../utils/obs-zone-map.util';
import {
  buildObsZoneShapesForCircuit,
  buildObsZonesGeoJson
} from './obs-zone-geojson.util';
import { DEFAULT_TASK_EXPORT_RADIUS_M } from '../../models/task-declaration.model';
import { WaypointService } from '../../services/waypoint.service';
import { TaskStateService } from '../../services/task-state.service';
import { DistanceService } from '../../services/distance.service';
import { AirspaceLayerService, AirspaceLoadResult } from '../../services/airspace-layer.service';
import { DEFAULT_POAFF_REGION_ID } from '../../config/map-airspace.config';
import { Waypoint, WaypointType } from '../../models/waypoint.model';
import {
  defaultTaskBadge,
  formatMapRoleSuffix,
  patchWaypointsGeoJson,
  type WaypointMapFeatureProps
} from './map-waypoints-geojson.util';
import { WaypointMapAction } from './map-waypoint-popup.util';
import {
  WaypointEditDialogComponent,
  WaypointEditPayload
} from '../waypoint-edit-dialog/waypoint-edit-dialog.component';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { UiFeedbackService } from '../../services/ui-feedback.service';
import { MapFocusService } from '../../services/map-focus.service';

const SHOW_FULL_CATALOG_KEY = 'gc-map-show-full-catalog';
const MAP_BASEMAP_KEY = 'gc-map-basemap';
import type { StyleSpecification } from 'maplibre-gl';
import { formatElevationDisplay } from '../../utils/elevation.util';
import {
  applyBasemapToMap,
  BASEMAP_PRESETS,
  buildBaseMapStyle,
  CATALOG_CLUSTER_MAX_ZOOM,
  CATALOG_DOT_MIN_ZOOM,
  DEFAULT_BASEMAP_ID,
  isBasemapId,
  MAP_LAYER,
  MAP_SOURCE,
  MAP_TERRAIN_HILLSHADE_KEY,
  reorderMapOverlayLayers,
  setTerrainHillshadeVisible,
  southWestNorthEastToLngLatBounds,
  type BasemapId
} from './map-style.constants';
import { buildTaskLinesGeoJson } from './map-task-lines-geojson.util';
import { WaypointContextMenuComponent } from './waypoint-context-menu.component';
const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Couches ouvrant le menu contextuel waypoint (pastilles, badges et libellés). */
const WAYPOINT_MENU_LAYERS: string[] = [
  MAP_LAYER.TASK_DOT,
  MAP_LAYER.TASK_LABEL,
  MAP_LAYER.CATALOG_DOT,
  MAP_LAYER.CATALOG_LABEL
];

function setGeoJsonData(map: MaplibreMap, sourceId: string, data: FeatureCollection): void {
  const source = map.getSource(sourceId);
  if (source && source.type === 'geojson') {
    (source as GeoJSONSource).setData(data);
  }
}

export interface MapContextMenuState {
  waypoint: Waypoint;
  x: number;
  y: number;
}

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MapComponent,
    WaypointEditDialogComponent,
    WaypointContextMenuComponent,
    Select,
    ToggleSwitch,
    Tooltip,
    TranslatePipe
  ],
  templateUrl: './map-view.component.html',
  styleUrls: ['./map-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MapViewComponent implements OnInit {
  private waypointService = inject(WaypointService);
  readonly taskState = inject(TaskStateService);
  private uiFeedback = inject(UiFeedbackService);
  private i18n = inject(TranslateService);
  private distanceService = inject(DistanceService);
  private mapFocus = inject(MapFocusService);
  readonly airspaceLayerService = inject(AirspaceLayerService);

  compact = input(false);

  actionMessage = output<string>();

  waypoints = this.waypointService.waypoints;
  selectedWaypointIds = this.taskState.selectedWaypointIds;
  circuitLegs = this.taskState.circuitLegs;
  defaultZoneRadiusM = this.taskState.defaultZoneRadiusM;

  readonly basemapId = signal<BasemapId>(DEFAULT_BASEMAP_ID);
  /** Style initial uniquement — les changements de fond passent par applyBasemapToMap. */
  mapStyle: StyleSpecification = buildBaseMapStyle(DEFAULT_BASEMAP_ID);
  readonly mapCenter = signal<[number, number]>([6.5, 46.5]);
  readonly mapZoom = signal<[number]>([6]);

  readonly typeFilterOptions = computed(() => {
    this.i18n.locale();
    return WAYPOINT_TYPE_ORDER.map(type => waypointTypeDisplayI18n(type, this.i18n));
  });
  readonly poaffRegions = this.airspaceLayerService.poaffRegions;
  readonly contextPopupLabels = computed(() => {
    this.i18n.locale();
    return mapPopupLabels(this.i18n);
  });

  obsZonesVisible = signal(true);
  airspaceVisible = signal(false);
  airspaceRegionId = signal(DEFAULT_POAFF_REGION_ID);
  airspaceStatus = signal<string | null>(null);
  airspaceLoading = signal(false);
  airspaceConfigReady = signal(false);

  catalogTypeFilter = signal<WaypointType[]>(['turnpoint', 'airfield', 'landable', 'custom']);
  filtersExpanded = signal(false);
  /** B.1 : masquer le catalogue par défaut. */
  showFullCatalog = signal(false);
  basemapPanelExpanded = signal(false);
  /** Ombrage relief Mapterhorn (DEM reste actif pour l’altitude au curseur). */
  terrainHillshadeVisible = signal(false);
  cursorTerrainElevM = signal<number | null>(null);

  readonly mapLegendItems = computed(() => {
    this.i18n.locale();
    const types = this.typeFilterOptions().map(f => ({
      color: f.color,
      label: f.shortLabel
    }));
    return {
      task: this.i18n.t('map.legendTask'),
      catalog: this.i18n.t('map.legendCatalog'),
      cluster: this.i18n.t('map.legendCluster'),
      types
    };
  });

  readonly catalogToggleLabel = computed(() => {
    this.i18n.locale();
    const n = this.waypoints().length;
    if (this.showFullCatalog()) {
      return this.i18n.t('map.hideFullCatalog');
    }
    return n > 0
      ? this.i18n.t('map.showFullCatalogCount', { count: n })
      : this.i18n.t('map.showFullCatalog');
  });

  readonly mapFabToolbarAria = computed(() => {
    this.i18n.locale();
    return this.i18n.t('map.fabToolbarAria');
  });

  readonly hasTask = computed(() => this.selectedWaypointIds().length > 0);

  readonly filtersFabDisabled = computed(
    () => !this.shouldShowCatalog() && !this.showFullCatalog()
  );

  readonly basemapOptions = computed(() => {
    this.i18n.locale();
    return BASEMAP_PRESETS.map(p => ({
      id: p.id,
      icon: p.icon,
      label: this.i18n.t(p.labelKey)
    }));
  });

  readonly cursorElevationLine = computed(() => {
    this.i18n.locale();
    const m = this.cursorTerrainElevM();
    if (m == null || !Number.isFinite(m)) {
      return null;
    }
    return this.i18n.t('map.terrain.cursorElevation', {
      value: formatElevationDisplay(m)
    });
  });

  private map: MaplibreMap | null = null;
  private terrainElevationRaf = 0;
  /** Première couche métier (ancrage pour changement de fond). */
  private dataLayerAnchorId: string | null = null;
  private airspacePopup: Popup | null = null;
  private readonly taskFeatureCache = new Map<string, Feature<Point, WaypointMapFeatureProps>>();
  private readonly catalogFeatureCache = new Map<string, Feature<Point, WaypointMapFeatureProps>>();
  private focusPulseTimer: ReturnType<typeof setTimeout> | null = null;
  mapReady = signal(false);

  contextMenu = signal<MapContextMenuState | null>(null);

  editDialogOpen = signal(false);
  editingWaypoint = signal<Waypoint | null>(null);
  editIsCreate = signal(false);
  private pendingCreateCoords: { lat: number; lng: number } | null = null;

  taskDistanceKm = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.waypoints();
      this.catalogTypeFilter();
      this.selectedWaypointIds();
      this.circuitLegs();
      this.showFullCatalog();
      this.mapFocus.focusedWaypointId();
      this.mapFocus.focusedLegIndex();
      if (this.mapReady()) {
        this.updateWaypointsSource();
      }
    });

    effect(() => {
      this.selectedWaypointIds();
      this.circuitLegs();
      if (this.mapReady()) {
        this.updateTaskLines();
        this.updateTaskDistanceLabel();
      }
    });

    effect(() => {
      this.obsZonesVisible();
      this.circuitLegs();
      this.defaultZoneRadiusM();
      this.waypoints();
      if (this.mapReady()) {
        this.updateObsZones();
      }
    });
  }

  toggleFilters(): void {
    this.filtersExpanded.update(v => !v);
    if (this.filtersExpanded()) {
      this.basemapPanelExpanded.set(false);
    }
  }

  toggleBasemapPanel(): void {
    this.basemapPanelExpanded.update(v => !v);
    if (this.basemapPanelExpanded()) {
      this.filtersExpanded.set(false);
    }
  }

  toggleTerrainHillshade(): void {
    const next = !this.terrainHillshadeVisible();
    this.terrainHillshadeVisible.set(next);
    localStorage.setItem(MAP_TERRAIN_HILLSHADE_KEY, next ? '1' : '0');
    const map = this.map;
    if (map) {
      setTerrainHillshadeVisible(map, next);
    }
  }

  selectBasemap(id: BasemapId): void {
    if (id === this.basemapId()) {
      this.basemapPanelExpanded.set(false);
      return;
    }
    this.basemapId.set(id);
    localStorage.setItem(MAP_BASEMAP_KEY, id);
    const map = this.map;
    if (map && this.dataLayerAnchorId) {
      applyBasemapToMap(map, id, this.dataLayerAnchorId);
    }
    this.basemapPanelExpanded.set(false);
  }


  toggleFullCatalog(): void {
    this.showFullCatalog.update(v => {
      const next = !v;
      localStorage.setItem(SHOW_FULL_CATALOG_KEY, next ? '1' : '0');
      return next;
    });
  }

  enableCatalogForPicker(): void {
    this.showFullCatalog.set(true);
    localStorage.setItem(SHOW_FULL_CATALOG_KEY, '1');
  }

  private updateTaskDistanceLabel(): void {
    const wps = this.selectedWaypointIds()
      .map(id => this.waypointService.getWaypoint(id))
      .filter((wp): wp is Waypoint => wp !== undefined);

    if (wps.length < 2) {
      this.taskDistanceKm.set(null);
      return;
    }

    const { taskDistance, totalDistance } = this.distanceService.calculateTaskDistance(
      wps,
      'km',
      this.taskState.getCircuitRoles()
    );
    const label =
      totalDistance > taskDistance + 0.05
        ? `${taskDistance.toFixed(1)} km (${totalDistance.toFixed(1)} total)`
        : `${taskDistance.toFixed(1)} km`;
    this.taskDistanceKm.set(label);
  }

  isCatalogTypeVisible(type: WaypointType): boolean {
    return this.catalogTypeFilter().includes(type);
  }

  onCatalogTypeToggle(type: WaypointType, visible: boolean): void {
    this.catalogTypeFilter.update(types => {
      if (visible) {
        return types.includes(type) ? types : [...types, type];
      }
      return types.filter(t => t !== type);
    });
  }

  onAirspaceToggle(on: boolean): void {
    if (on) {
      void this.enableAirspaceLayer();
    } else {
      this.disableAirspaceLayer();
    }
  }

  private disableAirspaceLayer(): void {
    this.removeAirspaceFromMap();
    this.airspaceVisible.set(false);
    this.airspaceStatus.set(null);
  }

  private async enableAirspaceLayer(): Promise<void> {
    if (this.airspaceVisible() || this.airspaceLoading()) {
      return;
    }

    this.airspaceLoading.set(true);
    this.airspaceStatus.set(this.i18n.t('map.airspaceLoading'));

    const map = this.map;
    if (!map) {
      this.airspaceLoading.set(false);
      this.airspaceStatus.set(this.i18n.t('map.mapNotReady'));
      return;
    }

    const { result, failure } = await this.airspaceLayerService.loadPoaffWithDiagnostics(
      this.airspaceRegionId()
    );

    this.airspaceLoading.set(false);

    if (!result) {
      this.airspaceStatus.set(this.airspaceLayerService.poaffFailureMessage(failure));
      return;
    }

    this.applyAirspaceLayer(map, result);
    this.airspaceVisible.set(true);

    const hint =
      result.source === 'openaip'
        ? this.i18n.t('map.airspaceOpenAip')
        : this.i18n.t('map.airspacePoaff', { label: result.label });
    this.airspaceStatus.set(hint);
  }

  onAirspaceRegionChange(regionId: string): void {
    this.airspaceRegionId.set(regionId);
    if (this.airspaceVisible()) {
      void this.reloadAirspaceLayer();
    }
  }

  private async reloadAirspaceLayer(): Promise<void> {
    this.disableAirspaceLayer();
    await this.enableAirspaceLayer();
  }

  ngOnInit(): void {
    const storedBasemap = localStorage.getItem(MAP_BASEMAP_KEY);
    if (storedBasemap && isBasemapId(storedBasemap)) {
      this.basemapId.set(storedBasemap);
    }

    const storedHillshade = localStorage.getItem(MAP_TERRAIN_HILLSHADE_KEY);
    const hillshadeOn = storedHillshade === '1';
    this.terrainHillshadeVisible.set(hillshadeOn);
    this.mapStyle = buildBaseMapStyle(this.basemapId(), hillshadeOn);

    const storedCatalog = localStorage.getItem(SHOW_FULL_CATALOG_KEY);
    if (storedCatalog === '1') {
      this.showFullCatalog.set(true);
    }

    void this.airspaceLayerService.ensureConfigLoaded().then(() => {
      this.airspaceConfigReady.set(true);
    });

    const wps = this.waypointService.waypoints();
    if (wps.length > 0) {
      this.mapCenter.set([wps[0].longitude, wps[0].latitude]);
      this.mapZoom.set([9]);
    }
  }

  onMapLoad(map: MaplibreMap): void {
    this.map = map;
    map.doubleClickZoom.disable();
    this.initDataLayers(map);
    this.mapReady.set(true);
    this.updateWaypointsSource();
    this.updateTaskLines();
    this.updateObsZones();
    this.updateTaskDistanceLabel();

    for (const layerId of WAYPOINT_MENU_LAYERS) {
      map.on('click', layerId, e => this.onWaypointLayerClick(e));
      map.on('mouseenter', layerId, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
      });
    }
    map.on('click', MAP_LAYER.CATALOG_CLUSTER, e => this.onCatalogClusterClick(e));
    map.on('mouseenter', MAP_LAYER.CATALOG_CLUSTER, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', MAP_LAYER.CATALOG_CLUSTER, () => {
      map.getCanvas().style.cursor = '';
    });
    map.on('click', MAP_LAYER.AIRSPACE_FILL, e => this.showAirspacePopup(e));
    map.on('click', e => {
      const hitLayers = [...WAYPOINT_MENU_LAYERS, MAP_LAYER.CATALOG_CLUSTER];
      const onWaypoint = map.queryRenderedFeatures(e.point, { layers: hitLayers }).length;
      if (!onWaypoint) {
        this.closeContextMenu();
        this.basemapPanelExpanded.set(false);
      }
    });
    map.on('move', () => this.repositionContextMenu());
    map.on('mousemove', e => this.onMapMouseMove(e));
    map.on('mouseout', () => this.cursorTerrainElevM.set(null));
    setTerrainHillshadeVisible(map, this.terrainHillshadeVisible());

    requestAnimationFrame(() => {
      map.resize();
      this.updateWaypointsSource();
      this.updateObsZones();
    });
  }

  private onMapMouseMove(event: MapMouseEvent): void {
    const map = this.map;
    if (!map) {
      return;
    }
    cancelAnimationFrame(this.terrainElevationRaf);
    const { lng, lat } = event.lngLat;
    this.terrainElevationRaf = requestAnimationFrame(() => {
      const raw = map.queryTerrainElevation([lng, lat]);
      if (raw == null || !Number.isFinite(raw)) {
        this.cursorTerrainElevM.set(null);
        return;
      }
      this.cursorTerrainElevM.set(Math.round(raw));
    });
  }

  onMapDblClick(event: MapMouseEvent): void {
    event.preventDefault();
    const { lng, lat } = event.lngLat;
    this.closeContextMenu();
    this.pendingCreateCoords = { lat, lng };
    this.editingWaypoint.set({
      id: '',
      name: '',
      latitude: lat,
      longitude: lng,
      type: 'custom'
    });
    this.editIsCreate.set(true);
    this.editDialogOpen.set(true);
  }

  private initDataLayers(map: MaplibreMap): void {
    this.dataLayerAnchorId = MAP_LAYER.OBS_FILL;

    map.addSource(MAP_SOURCE.WAYPOINTS_TASK, { type: 'geojson', data: EMPTY_FC });
    map.addSource(MAP_SOURCE.WAYPOINTS_CATALOG, {
      type: 'geojson',
      data: EMPTY_FC,
      cluster: true,
      clusterMaxZoom: CATALOG_CLUSTER_MAX_ZOOM,
      clusterRadius: 50
    });
    map.addSource(MAP_SOURCE.TASK_LINES, { type: 'geojson', data: EMPTY_FC });
    map.addSource(MAP_SOURCE.TASK_LABELS, { type: 'geojson', data: EMPTY_FC });
    map.addSource(MAP_SOURCE.OBS_ZONES, { type: 'geojson', data: EMPTY_FC });

    map.addLayer({
      id: MAP_LAYER.OBS_FILL,
      type: 'fill',
      source: MAP_SOURCE.OBS_ZONES,
      filter: ['!=', ['get', 'isLine'], true],
      paint: {
        'fill-color': ['get', 'fill'],
        'fill-opacity': 0.14
      }
    });

    map.addLayer({
      id: MAP_LAYER.OBS_LINE,
      type: 'line',
      source: MAP_SOURCE.OBS_ZONES,
      paint: {
        'line-color': ['get', 'stroke'],
        'line-width': ['case', ['get', 'isLine'], 4, 2],
        'line-opacity': 0.9
      }
    });

    map.addLayer({
      id: MAP_LAYER.TASK_LINES,
      type: 'line',
      source: MAP_SOURCE.TASK_LINES,
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'counted'], true],
          '#fbbf24',
          '#94a3b8'
        ],
        'line-width': ['case', ['==', ['get', 'counted'], true], 5, 3],
        'line-opacity': ['case', ['==', ['get', 'counted'], true], 0.95, 0.7],
        'line-dasharray': [
          'case',
          ['==', ['get', 'counted'], true],
          ['literal', [1, 0]],
          ['literal', [7, 6]]
        ]
      }
    });

    map.addLayer({
      id: MAP_LAYER.TASK_LABELS,
      type: 'symbol',
      source: MAP_SOURCE.TASK_LABELS,
      layout: {
        'text-field': ['get', 'text'],
        'text-size': 11,
        'text-font': ['Open Sans Regular'],
        'text-offset': [0, -1.2]
      },
      paint: {
        'text-color': '#fbbf24',
        'text-halo-color': '#0f172a',
        'text-halo-width': 1.2
      }
    });

    map.addLayer({
      id: MAP_LAYER.CATALOG_CLUSTER,
      type: 'circle',
      source: MAP_SOURCE.WAYPOINTS_CATALOG,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#475569',
        'circle-opacity': 0.6,
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          14,
          25,
          18,
          100,
          22,
          500,
          28
        ],
        'circle-stroke-width': 1,
        'circle-stroke-color': '#94a3b8'
      }
    });

    map.addLayer({
      id: MAP_LAYER.CATALOG_CLUSTER_COUNT,
      type: 'symbol',
      source: MAP_SOURCE.WAYPOINTS_CATALOG,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-size': 11,
        'text-font': ['Open Sans Bold']
      },
      paint: {
        'text-color': '#f8fafc'
      }
    });

    map.addLayer({
      id: MAP_LAYER.CATALOG_DOT,
      type: 'circle',
      source: MAP_SOURCE.WAYPOINTS_CATALOG,
      minzoom: CATALOG_DOT_MIN_ZOOM,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          CATALOG_DOT_MIN_ZOOM,
          2,
          CATALOG_CLUSTER_MAX_ZOOM + 1,
          3,
          14,
          5
        ],
        'circle-color': ['get', 'color'],
        'circle-opacity': 1,
        'circle-stroke-width': 0
      }
    });

    map.addLayer({
      id: MAP_LAYER.CATALOG_LABEL,
      type: 'symbol',
      source: MAP_SOURCE.WAYPOINTS_CATALOG,
      filter: ['!', ['has', 'point_count']],
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 10,
        'text-offset': [0.5, 0],
        'text-anchor': 'left',
        'text-font': ['Open Sans Regular'],
        'text-allow-overlap': false
      },
      paint: {
        'text-color': '#cbd5e1',
        'text-halo-color': '#0f172a',
        'text-halo-width': 1.2
      }
    });

    map.addLayer({
      id: MAP_LAYER.TASK_DOT,
      type: 'circle',
      source: MAP_SOURCE.WAYPOINTS_TASK,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          6,
          ['case', ['==', ['get', 'focused'], 1], 9, 6],
          12,
          ['case', ['==', ['get', 'focused'], 1], 12, 9]
        ],
        'circle-color': ['get', 'color'],
        'circle-opacity': 1,
        'circle-stroke-width': [
          'case',
          ['==', ['get', 'focused'], 1],
          3,
          2
        ],
        'circle-stroke-color': [
          'case',
          ['==', ['get', 'focused'], 1],
          '#ffffff',
          '#fbbf24'
        ]
      }
    });

    map.addLayer({
      id: MAP_LAYER.TASK_LABEL,
      type: 'symbol',
      source: MAP_SOURCE.WAYPOINTS_TASK,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 11,
        'text-offset': [0.7, 0],
        'text-anchor': 'left',
        'text-font': ['Open Sans Regular'],
        'text-allow-overlap': false
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#0f172a',
        'text-halo-width': 1.5
      }
    });

    reorderMapOverlayLayers(map);
  }

  /** Catalogue visible si toggle actif ou si la tâche est vide (évite une carte vide au démarrage). */
  shouldShowCatalog(): boolean {
    return this.showFullCatalog() || this.selectedWaypointIds().length === 0;
  }

  private onCatalogClusterClick(event: MapLayerMouseEvent): void {
    event.originalEvent.stopPropagation();
    this.closeContextMenu();
    const map = this.map;
    const feature = event.features?.[0];
    if (!map || !feature) return;
    const clusterId = feature.properties?.['cluster_id'] as number | undefined;
    if (clusterId === undefined) return;
    const source = map.getSource(MAP_SOURCE.WAYPOINTS_CATALOG) as GeoJSONSource;
    const coords = (feature.geometry as Point).coordinates as [number, number];
    void source.getClusterExpansionZoom(clusterId).then(zoom => {
      map.easeTo({ center: coords, zoom });
    });
  }

  private onWaypointLayerClick(event: MapLayerMouseEvent): void {
    event.originalEvent.stopPropagation();
    const feature = event.features?.[0];
    const id = feature?.properties?.['id'] as string | undefined;
    if (!id) return;
    const wp = this.waypointService.getWaypoint(id);
    if (!wp || !this.map) return;
    this.mapFocus.setFocus(wp.id);
    this.triggerFocusPulse();
    const point = this.map.project([wp.longitude, wp.latitude]);
    this.contextMenu.set({ waypoint: wp, x: point.x, y: point.y });
  }

  private triggerFocusPulse(): void {
    if (this.focusPulseTimer) {
      clearTimeout(this.focusPulseTimer);
    }
    this.focusPulseTimer = setTimeout(() => {
      this.focusPulseTimer = null;
    }, 2000);
  }

  private repositionContextMenu(): void {
    const ctx = this.contextMenu();
    const map = this.map;
    if (!ctx || !map) return;
    const point = map.project([ctx.waypoint.longitude, ctx.waypoint.latitude]);
    this.contextMenu.set({ ...ctx, x: point.x, y: point.y });
  }

  closeContextMenu(): void {
    this.contextMenu.set(null);
  }

  onContextAction(action: WaypointMapAction, wp: Waypoint): void {
    void this.handleWaypointAction(action, wp);
  }

  private showAirspacePopup(event: MapLayerMouseEvent): void {
    const feature = event.features?.[0];
    const map = this.map;
    if (!feature || !map) return;
    const html = this.airspaceLayerService.buildPoaffPopupHtml(
      feature as Feature<Geometry, PoaffProperties>
    );
    this.airspacePopup?.remove();
    this.airspacePopup = new Popup({ closeOnClick: true, maxWidth: '280px' })
      .setLngLat(event.lngLat)
      .setHTML(html)
      .addTo(map);
  }

  onEditDialogSave(payload: WaypointEditPayload): void {
    if (this.editIsCreate()) {
      const wp = this.waypointService.addWaypoint(payload);
      this.taskState.addTurnpoint(wp.id);
      this.actionMessage.emit(this.i18n.t('common.added', { name: wp.name }));
    } else {
      const current = this.editingWaypoint();
      if (current) {
        this.waypointService.updateWaypoint(current.id, payload);
        this.actionMessage.emit(this.i18n.t('common.updated', { name: payload.name }));
      }
    }
    this.closeEditDialog();
  }

  onEditDialogCancel(): void {
    this.closeEditDialog();
  }

  private closeEditDialog(): void {
    this.editDialogOpen.set(false);
    this.editingWaypoint.set(null);
    this.editIsCreate.set(false);
    this.pendingCreateCoords = null;
  }

  private openEditDialog(wp: Waypoint): void {
    this.closeContextMenu();
    this.editingWaypoint.set(wp);
    this.editIsCreate.set(false);
    this.editDialogOpen.set(true);
  }

  private taskWaypointIds(): Set<string> {
    return new Set(this.selectedWaypointIds());
  }

  private taskWaypointsToRender(): Waypoint[] {
    const seen = new Set<string>();
    const result: Waypoint[] = [];
    for (const id of this.selectedWaypointIds()) {
      const wp = this.waypointService.getWaypoint(id);
      if (wp && !seen.has(wp.id)) {
        seen.add(wp.id);
        result.push(wp);
      }
    }
    return result;
  }

  private catalogWaypointsToRender(): Waypoint[] {
    if (!this.shouldShowCatalog()) {
      return [];
    }
    const taskIds = this.taskWaypointIds();
    const seen = new Set<string>();
    const result: Waypoint[] = [];
    for (const wp of this.waypoints()) {
      if (taskIds.has(wp.id)) continue;
      if (!this.isCatalogTypeVisible(wp.type)) continue;
      if (seen.has(wp.id)) continue;
      seen.add(wp.id);
      result.push(wp);
    }
    return result;
  }

  private waypointGeoJsonInput(
    waypoints: Waypoint[],
    opts: { catalogOnly: boolean }
  ): Parameters<typeof patchWaypointsGeoJson>[1] {
    const taskIds = this.taskWaypointIds();
    const focusedId = this.mapFocus.focusedWaypointId();
    return {
      waypoints,
      getSuffix: wp => this.waypointSuffix(wp),
      getBadge: wp =>
        defaultTaskBadge(wp, this.taskState.getCircuitIndices(wp.id)),
      isInCircuit: wp => this.taskState.getCircuitIndices(wp.id).length > 0,
      isInTask: wp => taskIds.has(wp.id),
      isCatalogOnly: () => opts.catalogOnly,
      isFocused: wp => focusedId === wp.id
    };
  }

  private updateWaypointsSource(): void {
    const map = this.map;
    if (!map) return;
    const taskData = patchWaypointsGeoJson(
      this.taskFeatureCache,
      this.waypointGeoJsonInput(this.taskWaypointsToRender(), { catalogOnly: false })
    );
    setGeoJsonData(map, MAP_SOURCE.WAYPOINTS_TASK, taskData);

    const showCatalog = this.shouldShowCatalog();
    this.setCatalogLayersVisible(map, showCatalog);
    const catalogData = patchWaypointsGeoJson(
      this.catalogFeatureCache,
      this.waypointGeoJsonInput(this.catalogWaypointsToRender(), { catalogOnly: true })
    );
    setGeoJsonData(map, MAP_SOURCE.WAYPOINTS_CATALOG, catalogData);
  }

  private setCatalogLayersVisible(map: MaplibreMap, visible: boolean): void {
    const vis = visible ? 'visible' : 'none';
    for (const layerId of [
      MAP_LAYER.CATALOG_CLUSTER,
      MAP_LAYER.CATALOG_CLUSTER_COUNT,
      MAP_LAYER.CATALOG_DOT,
      MAP_LAYER.CATALOG_LABEL
    ]) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', vis);
      }
    }
  }

  private waypointSuffix(wp: Waypoint): string | null {
    const roleTokens = this.taskState.getWaypointMapRoleTokens(wp.id);
    if (roleTokens.length > 0) {
      return formatMapRoleSuffix(roleTokens);
    }
    const indices = this.taskState.getCircuitIndices(wp.id);
    if (indices.length > 0) {
      return `(${indices.join(',')})`;
    }
    return null;
  }

  onObsZonesToggle(visible: boolean): void {
    this.obsZonesVisible.set(visible);
    this.updateObsZones();
  }

  refreshObservationZones(): void {
    if (this.mapReady()) {
      this.updateObsZones();
    }
  }

  private updateObsZones(): void {
    const map = this.map;
    if (!map) return;
    if (!this.obsZonesVisible() || this.circuitLegs().length === 0) {
      setGeoJsonData(map, MAP_SOURCE.OBS_ZONES, EMPTY_FC);
      return;
    }

    const wpById = new Map(this.waypoints().map(w => [w.id, w]));
    const shapes = buildObsZoneShapesForCircuit(
      this.circuitLegs(),
      wpById,
      this.defaultZoneRadiusM() || DEFAULT_TASK_EXPORT_RADIUS_M
    );
    setGeoJsonData(map, MAP_SOURCE.OBS_ZONES, buildObsZonesGeoJson(shapes));
  }

  private updateTaskLines(): void {
    const map = this.map;
    if (!map) return;
    const wps = this.selectedWaypointIds()
      .map(id => this.waypointService.getWaypoint(id))
      .filter((wp): wp is Waypoint => wp !== undefined);

    if (wps.length < 2) {
      setGeoJsonData(map, MAP_SOURCE.TASK_LINES, EMPTY_FC);
      setGeoJsonData(map, MAP_SOURCE.TASK_LABELS, EMPTY_FC);
      return;
    }

    const { legDistances } = this.distanceService.calculateTaskDistance(
      wps,
      'km',
      this.taskState.getCircuitRoles()
    );

    const legs = legDistances.map(leg => ({
      from: wps[leg.fromIndex],
      to: wps[leg.toIndex],
      counted: leg.counted,
      distanceKm: leg.distance
    }));

    const { lines, labels } = buildTaskLinesGeoJson(legs);
    setGeoJsonData(map, MAP_SOURCE.TASK_LINES, lines);
    setGeoJsonData(map, MAP_SOURCE.TASK_LABELS, labels);
  }

  private applyAirspaceLayer(map: MaplibreMap, result: AirspaceLoadResult): void {
    this.removeAirspaceFromMap();

    if (result.source === 'openaip' && result.rasterTileUrl) {
      map.addSource(MAP_SOURCE.OPENAIP, {
        type: 'raster',
        tiles: [result.rasterTileUrl],
        tileSize: 256,
        scheme: 'tms',
        maxzoom: 14
      });
      map.addLayer(
        {
          id: MAP_LAYER.OPENAIP_RASTER,
          type: 'raster',
          source: MAP_SOURCE.OPENAIP,
          paint: { 'raster-opacity': 0.72 }
        },
        MAP_LAYER.OBS_FILL
      );
      return;
    }

    if (result.geojson) {
      map.addSource(MAP_SOURCE.AIRSPACE, {
        type: 'geojson',
        data: result.geojson
      });
      map.addLayer(
        {
          id: MAP_LAYER.AIRSPACE_FILL,
          type: 'fill',
          source: MAP_SOURCE.AIRSPACE,
          paint: {
            'fill-color': ['coalesce', ['get', 'fill'], '#f0abfc'],
            'fill-opacity': [
              'min',
              ['*', ['coalesce', ['get', 'fill-opacity'], 0.45], 0.55],
              0.45
            ]
          }
        },
        MAP_LAYER.OBS_FILL
      );
      map.addLayer(
        {
          id: MAP_LAYER.AIRSPACE_LINE,
          type: 'line',
          source: MAP_SOURCE.AIRSPACE,
          paint: {
            'line-color': ['coalesce', ['get', 'stroke'], '#c026d3'],
            'line-width': ['coalesce', ['get', 'stroke-width'], 1.5],
            'line-opacity': ['coalesce', ['get', 'stroke-opacity'], 0.85]
          }
        },
        MAP_LAYER.OBS_FILL
      );
    }

    reorderMapOverlayLayers(map);
  }

  private removeAirspaceFromMap(): void {
    const map = this.map;
    if (!map) return;
    this.airspacePopup?.remove();
    this.airspacePopup = null;

    for (const layerId of [
      MAP_LAYER.AIRSPACE_FILL,
      MAP_LAYER.AIRSPACE_LINE,
      MAP_LAYER.OPENAIP_RASTER
    ]) {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    }
    for (const sourceId of [MAP_SOURCE.AIRSPACE, MAP_SOURCE.OPENAIP]) {
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    }
  }

  centerOnTask(): void {
    const map = this.map;
    if (!map) return;

    const legs = this.circuitLegs();
    const wpById = new Map(this.waypoints().map(w => [w.id, w]));
    if (legs.length === 0) return;

    let bounds: [[number, number], [number, number]] | null = null;
    for (const leg of legs) {
      const wp = wpById.get(leg.waypointId);
      if (wp) {
        bounds = extendBoundsWithShape(bounds, {
          kind: 'circle',
          legIndex: 0,
          role: leg.role,
          center: [wp.latitude, wp.longitude],
          radiusM: leg.obsZone?.r1M ?? this.defaultZoneRadiusM(),
          label: ''
        });
      }
    }
    if (this.obsZonesVisible()) {
      const shapes = buildObsZoneShapesForCircuit(
        legs,
        wpById,
        this.defaultZoneRadiusM() || DEFAULT_TASK_EXPORT_RADIUS_M
      );
      for (const shape of shapes) {
        bounds = extendBoundsWithShape(bounds, shape);
      }
    }

    if (bounds) {
      map.fitBounds(southWestNorthEastToLngLatBounds(bounds), {
        padding: 48,
        maxZoom: 14
      });
      return;
    }

    const points = legs
      .map(l => wpById.get(l.waypointId))
      .filter((wp): wp is Waypoint => wp !== undefined);
    if (points.length === 1) {
      map.flyTo({ center: [points[0].longitude, points[0].latitude], zoom: 11 });
    }
  }

  centerOnWaypoint(waypointId: string): void {
    const map = this.map;
    const wp = this.waypointService.getWaypoint(waypointId);
    if (!map || !wp) return;
    this.mapFocus.setFocus(waypointId);
    this.triggerFocusPulse();
    map.flyTo({
      center: [wp.longitude, wp.latitude],
      zoom: Math.max(map.getZoom(), 12),
      duration: 400
    });
  }

  centerOnAll(): void {
    const map = this.map;
    if (!map) return;

    const wps = this.waypoints();
    if (wps.length === 0) return;

    if (wps.length === 1) {
      map.flyTo({ center: [wps[0].longitude, wps[0].latitude], zoom: 11 });
      return;
    }

    let south = 90;
    let west = 180;
    let north = -90;
    let east = -180;
    for (const wp of wps) {
      south = Math.min(south, wp.latitude);
      north = Math.max(north, wp.latitude);
      west = Math.min(west, wp.longitude);
      east = Math.max(east, wp.longitude);
    }
    map.fitBounds(
      [
        [west, south],
        [east, north]
      ],
      { padding: 40, maxZoom: 10 }
    );
  }


  private async handleWaypointAction(action: WaypointMapAction, wp: Waypoint): Promise<void> {
    if (action === 'delete-waypoint') {
      const ok = await this.uiFeedback.confirm({
        header: this.i18n.t('map.deleteFromDbHeader'),
        message: this.i18n.t('map.deleteFromDbMessage', { name: wp.name }),
        acceptLabel: this.i18n.t('common.delete'),
        acceptButtonStyleClass: 'p-button-danger'
      });
      this.closeContextMenu();
      if (!ok) return;
      this.taskState.removeAllOccurrences(wp.id);
      this.waypointService.deleteWaypoint(wp.id);
      this.actionMessage.emit(this.i18n.t('mapActions.waypointDeleted', { name: wp.name }));
      return;
    }
    const message = this.runWaypointAction(action, wp);
    this.closeContextMenu();
    if (message) this.actionMessage.emit(message);
  }

  private runWaypointAction(action: WaypointMapAction, wp: Waypoint): string | null {
    switch (action) {
      case 'set-departure':
        if (!this.taskState.setDeparture(wp.id)) {
          return this.i18n.t('mapActions.onlyAirfieldDeparture');
        }
        return this.i18n.t('mapActions.setDepartureDone', { name: wp.name });
      case 'set-arrival':
        if (!this.taskState.setArrival(wp.id)) {
          return this.i18n.t('mapActions.onlyAirfieldArrival');
        }
        return this.i18n.t('mapActions.setArrivalDone', { name: wp.name });
      case 'set-turnpoint':
        this.taskState.addTurnpoint(wp.id);
        return this.i18n.t('circuit.waypointAddedTurn', { name: wp.name });
      case 'edit':
        this.openEditDialog(wp);
        return null;
      case 'remove-last':
        this.taskState.removeLastOccurrence(wp.id);
        return this.i18n.t('mapActions.removeLast', { name: wp.name });
      case 'remove-all':
        this.taskState.removeAllOccurrences(wp.id);
        return this.i18n.t('mapActions.removeAll', { name: wp.name });
      case 'center': {
        this.centerOnWaypoint(wp.id);
        return null;
      }
      case 'delete-waypoint':
        return null;
      default:
        return null;
    }
  }

  invalidateSize(): void {
    this.map?.resize();
  }

  waypointTypeLabel(wp: Waypoint): string {
    return waypointTypeDisplayI18n(wp.type, this.i18n).description;
  }

  readonly circuitRoleLabel = (role: Parameters<typeof circuitRoleShortLabelI18n>[0]) =>
    circuitRoleShortLabelI18n(role, this.i18n);
}
