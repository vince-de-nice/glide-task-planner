import {
  Component,
  inject,
  input,
  output,
  OnInit,
  effect,
  ViewChild,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeafletDirective } from '@bluehalo/ngx-leaflet';
import {
  latLng,
  tileLayer,
  layerGroup,
  marker,
  polyline,
  divIcon,
  popup,
  Map,
  MapOptions,
  LeafletMouseEvent,
  LayerGroup,
} from 'leaflet';
import { WaypointService } from '../../services/waypoint.service';
import { TaskStateService } from '../../services/task-state.service';
import { DistanceService } from '../../services/distance.service';
import { Waypoint, WaypointType } from '../../models/waypoint.model';
import { buildMapMarkerHtml, formatMapRoleSuffix } from './map-marker.util';
import {
  buildWaypointContextPopupHtml,
  waypointTypeLabel,
  WaypointMapAction
} from './map-waypoint-popup.util';

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

const MAP_TYPE_FILTERS: { type: WaypointType; label: string; color: string }[] = [
  { type: 'turnpoint', label: 'Turnpoints', color: '#ea580c' },
  { type: 'airfield', label: 'Aérodromes', color: '#2563eb' },
  { type: 'landable', label: 'Atterrissables', color: '#16a34a' },
  { type: 'custom', label: 'Perso', color: '#9333ea' }
];

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [CommonModule, LeafletDirective],
  templateUrl: './map-view.component.html',
  styleUrls: ['./map-view.component.scss']
})
export class MapViewComponent implements OnInit {
  @ViewChild(LeafletDirective) private leaflet?: LeafletDirective;

  private waypointService = inject(WaypointService);
  private taskState = inject(TaskStateService);
  private distanceService = inject(DistanceService);

  compact = input(false);

  /** Message de retour (toast) après une action sur un waypoint. */
  actionMessage = output<string>();

  waypoints = this.waypointService.waypoints;
  selectedWaypointIds = this.taskState.selectedWaypointIds;

  readonly typeFilterOptions = MAP_TYPE_FILTERS;

  /** Visibilité du catalogue par type (le circuit ignore ces filtres). */
  private catalogTypeVisible = signal<Record<WaypointType, boolean>>({
    turnpoint: true,
    airfield: true,
    landable: true,
    custom: true
  });

  mapOptions!: MapOptions;

  private map: Map | null = null;
  private markersLayer: LayerGroup | null = null;
  private taskLinesLayer: LayerGroup | null = null;
  private mapReady = false;

  /** Distance tâche affichée sur la carte (km, hors branches déco/attero). */
  taskDistanceKm = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.waypoints();
      this.selectedWaypointIds();
      this.catalogTypeVisible();
      if (this.mapReady && this.map && this.markersLayer) {
        this.refreshMarkers();
        this.updateTaskLines();
        this.updateTaskDistanceLabel();
      }
    });
  }

  private updateTaskDistanceLabel(): void {
    const wps = this.selectedWaypointIds()
      .map(id => this.waypointService.getWaypoint(id))
      .filter((wp): wp is Waypoint => wp !== undefined);

    if (wps.length < 2) {
      this.taskDistanceKm.set(null);
      return;
    }

    const { taskDistance, totalDistance } = this.distanceService.calculateTaskDistance(wps, 'km');
    const label =
      totalDistance > taskDistance + 0.05
        ? `${taskDistance.toFixed(1)} km (${totalDistance.toFixed(1)} total)`
        : `${taskDistance.toFixed(1)} km`;
    this.taskDistanceKm.set(label);
  }

  isCatalogTypeVisible(type: WaypointType): boolean {
    return this.catalogTypeVisible()[type];
  }

  toggleCatalogTypeFilter(type: WaypointType): void {
    this.catalogTypeVisible.update(current => ({
      ...current,
      [type]: !current[type]
    }));
    if (this.mapReady) {
      this.refreshMarkers();
    }
  }

  ngOnInit(): void {
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

  onMapReady(map: Map): void {
    this.map = map;
    map.doubleClickZoom.disable();
    this.markersLayer = layerGroup().addTo(map);
    this.mapReady = true;
    this.refreshMarkers();
    this.updateTaskLines();
    this.updateTaskDistanceLabel();
    requestAnimationFrame(() => {
      map.invalidateSize();
      this.refreshMarkers();
      this.syncLabelVisibility();
    });
    this.syncLabelVisibility();
  }

  onMapZoomEnd(): void {
    this.syncLabelVisibility();
  }

  private syncLabelVisibility(): void {
    const map = this.getMap();
    if (!map) return;
    map
      .getContainer()
      .classList.toggle('vav-map-labels-visible', map.getZoom() >= MIN_ZOOM_FOR_LABELS);
  }

  onMapDoubleClick(event: LeafletMouseEvent): void {
    if (!this.map) return;
    event.originalEvent.preventDefault();
    event.originalEvent.stopPropagation();

    const { lat, lng } = event.latlng;
    const html = `
      <div class="poi-popup">
        <p><strong>Nouveau point</strong></p>
        <p class="poi-coords">${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
        <input type="text" id="poi-name-input" placeholder="Nom du point" maxlength="32" />
        <div class="poi-actions">
          <button type="button" id="poi-cancel-btn">Annuler</button>
          <button type="button" id="poi-add-btn">Ajouter</button>
        </div>
      </div>
    `;

    popup({ closeOnClick: true })
      .setLatLng([lat, lng])
      .setContent(html)
      .openOn(this.map);

    setTimeout(() => {
      document.getElementById('poi-cancel-btn')?.addEventListener('click', () => {
        this.map?.closePopup();
      });
      document.getElementById('poi-add-btn')?.addEventListener('click', () => {
        const input = document.getElementById('poi-name-input') as HTMLInputElement | null;
        const name = input?.value?.trim() || `Point ${lat.toFixed(3)}`;
        const wp = this.waypointService.addWaypoint({
          name,
          latitude: lat,
          longitude: lng,
          type: 'custom'
        });
        this.taskState.addWaypoint(wp.id);
        this.map?.closePopup();
      });
    }, 0);
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
      const roleLabels =
        wp.type === 'airfield' ? this.taskState.getAirfieldRoleLabels(wp.id) : [];

      let suffix: string | null = null;
      if (roleLabels.length > 0) {
        suffix = formatMapRoleSuffix(roleLabels);
      } else if (inCircuit) {
        suffix = `(${indices.join(',')})`;
      }

      const markerHtml = buildMapMarkerHtml({
        name: wp.name,
        type: wp.type,
        suffix
      });

      const icon = divIcon({
        className: 'vav-map-marker-icon',
        html: markerHtml,
        iconSize: [6, 6],
        iconAnchor: [3, 3]
      });

      marker([wp.latitude, wp.longitude], { icon })
        .bindTooltip(wp.name + (suffix ? ` ${suffix}` : ''), {
          direction: 'right',
          offset: [8, 0]
        })
        .on('click', (ev: LeafletMouseEvent) => {
          ev.originalEvent.stopPropagation();
          this.openWaypointContextMenu(wp);
        })
        .addTo(this.markersLayer!);
    }
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

    const { legDistances } = this.distanceService.calculateTaskDistance(wps, 'km');

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

    const points = this.selectedWaypointIds()
      .map(id => this.waypointService.getWaypoint(id))
      .filter((wp): wp is Waypoint => wp !== undefined);

    if (points.length === 0) return;

    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 11);
    } else {
      map.fitBounds(
        points.map(wp => [wp.latitude, wp.longitude]),
        { padding: [40, 40] }
      );
    }
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

  clearSelection(): void {
    this.taskState.clearSelection();
  }

  private openWaypointContextMenu(wp: Waypoint): void {
    if (!this.map) return;

    const circuitIndices = this.taskState.getCircuitIndices(wp.id);
    const html = buildWaypointContextPopupHtml({
      waypoint: wp,
      circuitIndices,
      typeLabel: waypointTypeLabel(wp.type)
    });

    const popupInstance = popup({
      closeOnClick: true,
      className: 'vav-wp-context-leaflet'
    })
      .setLatLng([wp.latitude, wp.longitude])
      .setContent(html)
      .openOn(this.map);

    const container = popupInstance.getElement();
    const menu = container?.querySelector('.vav-wp-ctx');
    if (!menu) return;

    menu.addEventListener('click', event => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      const action = target.getAttribute('data-action') as WaypointMapAction | null;
      if (!action) return;
      const message = this.runWaypointAction(action, wp);
      this.map?.closePopup();
      if (message) this.actionMessage.emit(message);
    });
  }

  private runWaypointAction(action: WaypointMapAction, wp: Waypoint): string | null {
    switch (action) {
      case 'add-circuit':
        this.taskState.addWaypoint(wp.id);
        return `« ${wp.name} » ajouté au circuit`;
      case 'remove-last':
        this.taskState.removeLastOccurrence(wp.id);
        return `« ${wp.name} » retiré du circuit`;
      case 'remove-all':
        this.taskState.removeAllOccurrences(wp.id);
        return `Toutes les occurrences de « ${wp.name} » retirées`;
      case 'center': {
        const map = this.getMap();
        map?.setView([wp.latitude, wp.longitude], Math.max(map.getZoom(), 11));
        return null;
      }
      case 'delete-custom':
        if (wp.type !== 'custom') return null;
        this.taskState.removeAllOccurrences(wp.id);
        this.waypointService.deleteWaypoint(wp.id);
        return `Point « ${wp.name} » supprimé`;
      default:
        return null;
    }
  }

  invalidateSize(): void {
    this.leaflet?.getMap()?.invalidateSize();
  }

  private getMap(): Map | null {
    return this.map ?? this.leaflet?.getMap() ?? null;
  }
}
