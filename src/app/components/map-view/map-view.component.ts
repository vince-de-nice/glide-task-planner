import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  OnInit,
  effect,
  ViewChild,
  signal
} from '@angular/core';
import { TranslateService } from '../../i18n/translate.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LeafletDirective } from '@bluehalo/ngx-leaflet';
import {
  latLng,
  tileLayer,
  layerGroup,
  marker,
  polyline,
  divIcon,
  popup,
  Map as LeafletMap,
  MapOptions,
  LeafletMouseEvent,
  LayerGroup,
  Layer
} from 'leaflet';
import { extendBoundsWithShape } from '../../utils/obs-zone-map.util';
import {
  buildObsZoneShapesForCircuit,
  renderObsZoneShapes
} from './map-obs-zones-layer.util';
import { DEFAULT_TASK_EXPORT_RADIUS_M } from '../../models/task-declaration.model';
import { WaypointService } from '../../services/waypoint.service';
import { TaskStateService } from '../../services/task-state.service';
import { DistanceService } from '../../services/distance.service';
import { AirspaceLayerService } from '../../services/airspace-layer.service';
import { DEFAULT_POAFF_REGION_ID } from '../../config/map-airspace.config';
import { Waypoint, WaypointType } from '../../models/waypoint.model';
import { buildMapMarkerHtml, estimateMapLabelSize, formatMapRoleSuffix } from './map-marker.util';
import {
  buildWaypointContextPopupHtml,
  waypointTypeLabel,
  WaypointMapAction
} from './map-waypoint-popup.util';
import {
  WaypointEditDialogComponent,
  WaypointEditPayload
} from '../waypoint-edit-dialog/waypoint-edit-dialog.component';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { Menu } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { Toolbar } from 'primeng/toolbar';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { UiFeedbackService } from '../../services/ui-feedback.service';
import { waypointTypeMapFilters } from '../../utils/waypoint-type-display.util';

const SATELLITE_TILES = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution:
    'Imagerie &copy; <a href="https://www.esri.com/">Esri</a> — Esri, Maxar, Earthstar Geographics'
};

const SATELLITE_LABELS = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  maxZoom: 19
};

/** Texte des libellés visible à partir de ce zoom Leaflet (plus on zoome, plus z est grand). */
const MIN_ZOOM_FOR_LABELS = 11;

const MAP_TYPE_FILTERS = waypointTypeMapFilters();

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LeafletDirective,
    WaypointEditDialogComponent,
    Button,
    Select,
    Menu,
    Toolbar,
    ToggleSwitch,
    Tooltip
  ],
  templateUrl: './map-view.component.html',
  styleUrls: ['./map-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MapViewComponent implements OnInit {
  @ViewChild(LeafletDirective) private leaflet?: LeafletDirective;

  private waypointService = inject(WaypointService);
  private taskState = inject(TaskStateService);
  private uiFeedback = inject(UiFeedbackService);
  private i18n = inject(TranslateService);
  private distanceService = inject(DistanceService);
  readonly airspaceLayerService = inject(AirspaceLayerService);

  compact = input(false);

  /** Message de retour (toast) après une action sur un waypoint. */
  actionMessage = output<string>();

  waypoints = this.waypointService.waypoints;
  selectedWaypointIds = this.taskState.selectedWaypointIds;
  circuitLegs = this.taskState.circuitLegs;
  defaultZoneRadiusM = this.taskState.defaultZoneRadiusM;

  readonly typeFilterOptions = MAP_TYPE_FILTERS;
  readonly poaffRegions = this.airspaceLayerService.poaffRegions;

  /** Aperçu à l’échelle des zones d’observation (CUP / tâche). */
  obsZonesVisible = signal(true);
  airspaceVisible = signal(false);
  airspaceRegionId = signal(DEFAULT_POAFF_REGION_ID);
  airspaceStatus = signal<string | null>(null);
  airspaceLoading = signal(false);
  /** true une fois `public/config/airspace.json` lu (affiche le bon mode POAFF / OpenAIP). */
  airspaceConfigReady = signal(false);

  /** Types de waypoints affichés sur la carte (catalogue). */
  catalogTypeFilter = signal<WaypointType[]>(['turnpoint', 'airfield', 'landable', 'custom']);

  filtersExpanded = signal(false);

  readonly toolbarMenuItems = computed<MenuItem[]>(() => {
    this.i18n.locale();
    return [
      {
        label: this.i18n.t('map.centerAll'),
        icon: 'pi pi-globe',
        command: () => this.centerOnAll()
      },
      {
        label: this.i18n.t('map.clearSelection'),
        icon: 'pi pi-trash',
        command: () => void this.clearSelection()
      },
      {
        label: this.i18n.t('map.helpTitle'),
        icon: 'pi pi-info-circle',
        command: () =>
          this.uiFeedback.info(this.i18n.t('map.helpTitle'), this.i18n.t('map.helpTooltip'))
      }
    ];
  });

  mapOptions!: MapOptions;

  private map: LeafletMap | null = null;
  private markersLayer: LayerGroup | null = null;
  private taskLinesLayer: LayerGroup | null = null;
  private obsZonesLayer: LayerGroup | null = null;
  private airspaceLayer: Layer | null = null;
  mapReady = signal(false);

  editDialogOpen = signal(false);
  editingWaypoint = signal<Waypoint | null>(null);
  editIsCreate = signal(false);
  private pendingCreateCoords: { lat: number; lng: number } | null = null;

  /** Distance tâche affichée sur la carte (km, hors branches déco/attero). */
  taskDistanceKm = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.waypoints();
      this.selectedWaypointIds();
      this.circuitLegs();
      this.defaultZoneRadiusM();
      this.obsZonesVisible();
      this.catalogTypeFilter();
      if (this.mapReady() && this.map && this.markersLayer) {
        this.refreshMarkers();
        this.updateTaskLines();
        this.updateObsZones();
      }
    });
  }

  toggleFilters(): void {
    this.filtersExpanded.update(v => !v);
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
    if (this.mapReady()) {
      this.refreshMarkers();
    }
  }

  onAirspaceToggle(on: boolean): void {
    if (on) {
      void this.enableAirspaceLayer();
    } else {
      this.disableAirspaceLayer();
    }
  }

  private disableAirspaceLayer(): void {
    this.removeAirspaceLayer();
    this.airspaceVisible.set(false);
    this.airspaceStatus.set(null);
  }

  private async enableAirspaceLayer(): Promise<void> {
    if (this.airspaceVisible() || this.airspaceLoading()) {
      return;
    }

    this.airspaceLoading.set(true);
    this.airspaceStatus.set('Chargement des espaces aériens…');

    if (!this.map) {
      this.airspaceLoading.set(false);
      this.airspaceStatus.set('Carte non initialisée — attendez un instant puis réessayez.');
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

    this.removeAirspaceLayer();
    result.layer.addTo(this.map);
    this.airspaceLayer = result.layer;
    this.airspaceVisible.set(true);

    const hint =
      result.source === 'openaip'
        ? 'OpenAIP (monde)'
        : `POAFF/SIA — ${result.label} (clé OpenAIP optionnelle dans public/config/airspace.json)`;
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

  private initAirspacePane(map: LeafletMap): void {
    if (!map.getPane('airspace')) {
      map.createPane('airspace');
      const pane = map.getPane('airspace');
      if (pane) pane.style.zIndex = '350';
    }
    if (!map.getPane('obsZones')) {
      map.createPane('obsZones');
      const pane = map.getPane('obsZones');
      if (pane) pane.style.zIndex = '420';
    }
  }

  private removeAirspaceLayer(): void {
    if (this.airspaceLayer && this.map) {
      this.map.removeLayer(this.airspaceLayer);
      this.airspaceLayer = null;
    }
  }

  ngOnInit(): void {
    void this.airspaceLayerService.ensureConfigLoaded().then(() => {
      this.airspaceConfigReady.set(true);
    });

    const wps = this.waypointService.waypoints();
    const center =
      wps.length > 0 ? latLng(wps[0].latitude, wps[0].longitude) : latLng(46.5, 6.5);

    this.mapOptions = {
      layers: [
        tileLayer(SATELLITE_TILES.url, {
          attribution: SATELLITE_TILES.attribution,
          maxZoom: 19
        }),
        tileLayer(SATELLITE_LABELS.url, {
          maxZoom: SATELLITE_LABELS.maxZoom,
          opacity: 0.85
        })
      ],
      zoom: wps.length > 0 ? 9 : 6,
      center,
      zoomControl: true
    };
  }

  onMapReady(map: LeafletMap): void {
    this.map = map;
    map.doubleClickZoom.disable();
    this.initAirspacePane(map);
    this.markersLayer = layerGroup().addTo(map);
    this.mapReady.set(true);
    this.refreshMarkers();
    this.updateTaskLines();
    this.updateObsZones();
    this.updateTaskDistanceLabel();
    requestAnimationFrame(() => {
      map.invalidateSize();
      this.refreshMarkers();
      this.updateObsZones();
      this.syncLabelVisibility();
    });
    this.syncLabelVisibility();
  }

  onMapZoomEnd(): void {
    this.syncLabelVisibility();
    if (this.mapReady() && this.markersLayer) {
      this.refreshMarkers();
    }
  }

  private syncLabelVisibility(): void {
    const map = this.getMap();
    if (!map) return;
    map
      .getContainer()
      .classList.toggle('gc-map-labels-visible', map.getZoom() >= MIN_ZOOM_FOR_LABELS);
  }

  onMapDoubleClick(event: LeafletMouseEvent): void {
    if (!this.map) return;
    event.originalEvent.preventDefault();
    event.originalEvent.stopPropagation();

    const { lat, lng } = event.latlng;
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

  onEditDialogSave(payload: WaypointEditPayload): void {
    if (this.editIsCreate()) {
      const wp = this.waypointService.addWaypoint(payload);
      this.taskState.addTurnpoint(wp.id);
      this.actionMessage.emit(`« ${wp.name} » ajouté`);
    } else {
      const current = this.editingWaypoint();
      if (current) {
        this.waypointService.updateWaypoint(current.id, payload);
        this.actionMessage.emit(`« ${payload.name} » mis à jour`);
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
    this.editingWaypoint.set(wp);
    this.editIsCreate.set(false);
    this.editDialogOpen.set(true);
  }

  private waypointsToRender(): Waypoint[] {
    const seen = new Set<string>();
    const result: Waypoint[] = [];

    for (const id of this.selectedWaypointIds()) {
      const wp = this.waypointService.getWaypoint(id);
      if (wp && !seen.has(wp.id)) {
        seen.add(wp.id);
        result.push(wp);
      }
    }

    for (const wp of this.waypoints()) {
      if (seen.has(wp.id)) continue;
      if (!this.isCatalogTypeVisible(wp.type)) continue;
      seen.add(wp.id);
      result.push(wp);
    }

    return result;
  }

  private refreshMarkers(): void {
    if (!this.map || !this.markersLayer) return;

    this.markersLayer.clearLayers();

    for (const wp of this.waypointsToRender()) {
      const indices = this.taskState.getCircuitIndices(wp.id);
      const inCircuit = indices.length > 0;
      const roleTokens = this.taskState.getWaypointMapRoleTokens(wp.id);

      let suffix: string | null = null;
      if (roleTokens.length > 0) {
        suffix = formatMapRoleSuffix(roleTokens);
      } else if (inCircuit) {
        suffix = `(${indices.join(',')})`;
      }

      const markerHtml = buildMapMarkerHtml({
        name: wp.name,
        type: wp.type,
        suffix
      });

      const labelsVisible = (this.map?.getZoom() ?? 0) >= MIN_ZOOM_FOR_LABELS;
      const iconSize = labelsVisible
        ? estimateMapLabelSize(wp.name, suffix)
        : ([6, 6] as [number, number]);
      const iconAnchor: [number, number] = labelsVisible
        ? [3, iconSize[1] / 2]
        : [3, 3];

      const icon = divIcon({
        className: 'gc-map-marker-icon',
        html: markerHtml,
        iconSize,
        iconAnchor
      });

      const mapMarker = marker([wp.latitude, wp.longitude], { icon });
      if (!labelsVisible) {
        mapMarker.bindTooltip(wp.name + (suffix ? ` ${suffix}` : ''), {
          direction: 'right',
          offset: [8, 0]
        });
      }
      mapMarker
        .on('click', (ev: LeafletMouseEvent) => {
          ev.originalEvent.stopPropagation();
          this.openWaypointContextMenu(wp);
        })
        .addTo(this.markersLayer!);
    }
  }

  onObsZonesToggle(visible: boolean): void {
    this.obsZonesVisible.set(visible);
    this.updateObsZones();
  }

  /** Rafraîchit les zones après modification depuis le dialogue circuit. */
  refreshObservationZones(): void {
    if (this.mapReady() && this.map) {
      this.updateObsZones();
    }
  }

  private updateObsZones(): void {
    if (!this.map) return;

    if (!this.obsZonesLayer) {
      this.obsZonesLayer = layerGroup([], { pane: 'obsZones' }).addTo(this.map);
    }
    this.obsZonesLayer.clearLayers();

    if (!this.obsZonesVisible() || this.circuitLegs().length === 0) {
      return;
    }

    const wpById = new Map(this.waypoints().map(w => [w.id, w]));
    const shapes = buildObsZoneShapesForCircuit(
      this.circuitLegs(),
      wpById,
      this.defaultZoneRadiusM() || DEFAULT_TASK_EXPORT_RADIUS_M
    );
    renderObsZoneShapes(this.obsZonesLayer, shapes);
  }

  private updateTaskLines(): void {
    if (!this.map) return;

    if (!this.taskLinesLayer) {
      this.taskLinesLayer = layerGroup().addTo(this.map);
    }
    this.taskLinesLayer.clearLayers();

    const wps = this.selectedWaypointIds()
      .map(id => this.waypointService.getWaypoint(id))
      .filter((wp): wp is Waypoint => wp !== undefined);

    if (wps.length < 2) return;

    const { legDistances } = this.distanceService.calculateTaskDistance(
      wps,
      'km',
      this.taskState.getCircuitRoles()
    );

    for (const leg of legDistances) {
      const from = wps[leg.fromIndex];
      const to = wps[leg.toIndex];
      polyline(
        [
          [from.latitude, from.longitude],
          [to.latitude, to.longitude]
        ],
        {
          color: leg.counted ? '#fbbf24' : '#94a3b8',
          weight: leg.counted ? 4 : 3,
          opacity: leg.counted ? 0.95 : 0.7,
          dashArray: leg.counted ? undefined : '7 6'
        }
      ).addTo(this.taskLinesLayer);
    }
  }

  centerOnTask(): void {
    const map = this.getMap();
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
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
      return;
    }

    const points = legs
      .map(l => wpById.get(l.waypointId))
      .filter((wp): wp is Waypoint => wp !== undefined);
    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 11);
    }
  }

  centerOnWaypoint(waypointId: string): void {
    const map = this.getMap();
    const wp = this.waypointService.getWaypoint(waypointId);
    if (!map || !wp) return;
    map.flyTo([wp.latitude, wp.longitude], Math.max(map.getZoom(), 12), { duration: 0.4 });
  }

  centerOnAll(): void {
    const map = this.getMap();
    if (!map) return;

    const wps = this.waypoints();
    if (wps.length === 0) return;

    if (wps.length === 1) {
      map.setView([wps[0].latitude, wps[0].longitude], 11);
    } else {
      map.fitBounds(
        wps.map(wp => [wp.latitude, wp.longitude]),
        { padding: [40, 40], maxZoom: 10 }
      );
    }
  }

  async clearSelection(): Promise<void> {
    if (this.selectedWaypointIds().length === 0) return;
    const ok = await this.uiFeedback.confirm({
      header: this.i18n.t('map.clearTaskHeader'),
      message: this.i18n.t('map.clearTaskMessage')
    });
    if (ok) {
      this.taskState.clearSelection();
    }
  }

  private openWaypointContextMenu(wp: Waypoint): void {
    if (!this.map) return;

    const html = buildWaypointContextPopupHtml({
      waypoint: wp,
      circuitLegs: this.taskState.circuitLegs(),
      typeLabel: waypointTypeLabel(wp.type),
      canSetDeparture: this.taskState.canSetDeparture(wp.id),
      canSetArrival: this.taskState.canSetArrival(wp.id)
    });

    const popupInstance = popup({
      closeOnClick: true,
      className: 'gc-wp-context-leaflet'
    })
      .setLatLng([wp.latitude, wp.longitude])
      .setContent(html)
      .openOn(this.map);

    const container = popupInstance.getElement();
    const menu = container?.querySelector('.gc-wp-ctx');
    if (!menu) return;

    menu.addEventListener('click', event => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      const action = target.getAttribute('data-action') as WaypointMapAction | null;
      if (!action) return;
      void this.handleWaypointAction(action, wp);
    });
  }

  private async handleWaypointAction(action: WaypointMapAction, wp: Waypoint): Promise<void> {
    if (action === 'delete-waypoint') {
      const ok = await this.uiFeedback.confirm({
        header: this.i18n.t('map.deleteFromDbHeader'),
        message: this.i18n.t('map.deleteFromDbMessage', { name: wp.name }),
        acceptLabel: this.i18n.t('common.delete'),
        acceptButtonStyleClass: 'p-button-danger'
      });
      this.map?.closePopup();
      if (!ok) return;
      this.taskState.removeAllOccurrences(wp.id);
      this.waypointService.deleteWaypoint(wp.id);
      this.actionMessage.emit(this.i18n.t('mapActions.waypointDeleted', { name: wp.name }));
      return;
    }
    const message = this.runWaypointAction(action, wp);
    this.map?.closePopup();
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
        const map = this.getMap();
        map?.setView([wp.latitude, wp.longitude], Math.max(map.getZoom(), 11));
        return null;
      }
      case 'delete-waypoint':
        return null;
      default:
        return null;
    }
  }

  invalidateSize(): void {
    this.leaflet?.getMap()?.invalidateSize();
  }

  private getMap(): LeafletMap | null {
    return this.map ?? this.leaflet?.getMap() ?? null;
  }
}
