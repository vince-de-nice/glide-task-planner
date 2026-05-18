import {
  Component,
  inject,
  input,
  OnInit,
  effect,
  ViewChild
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
  Polyline
} from 'leaflet';
import { WaypointService } from '../../services/waypoint.service';
import { TaskStateService } from '../../services/task-state.service';
import { Waypoint, WaypointType } from '../../models/waypoint.model';

const MAX_CATALOG_MARKERS_IN_VIEW = 350;
const MIN_ZOOM_FOR_CATALOG_MARKERS = 9;

const SATELLITE_TILES = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution:
    'Imagerie &copy; <a href="https://www.esri.com/">Esri</a> — Esri, Maxar, Earthstar Geographics'
};

const SATELLITE_LABELS = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  maxZoom: 19
};

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

  compact = input(false);

  waypoints = this.waypointService.waypoints;
  selectedWaypointIds = this.taskState.selectedWaypointIds;

  mapOptions!: MapOptions;

  private map: Map | null = null;
  private markersLayer: LayerGroup | null = null;
  private taskPolyline: Polyline | null = null;
  private mapReady = false;

  constructor() {
    effect(() => {
      this.waypoints();
      this.selectedWaypointIds();
      if (this.mapReady && this.map && this.markersLayer) {
        this.refreshMarkers();
        this.updatePolyline();
      }
    });
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
    this.markersLayer = layerGroup().addTo(map);
    this.mapReady = true;
    this.refreshMarkers();
    this.updatePolyline();
    requestAnimationFrame(() => {
      map.invalidateSize();
      this.refreshMarkers();
    });
  }

  onMapClick(event: LeafletMouseEvent): void {
    if (!this.map) return;
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

  onMapViewChanged(): void {
    if (this.mapReady) {
      this.refreshMarkers();
    }
  }

  private waypointsToRender(): Waypoint[] {
    if (!this.map) return [];

    const seen = new Set<string>();
    const result: Waypoint[] = [];

    for (const id of this.selectedWaypointIds()) {
      const wp = this.waypointService.getWaypoint(id);
      if (wp && !seen.has(wp.id)) {
        seen.add(wp.id);
        result.push(wp);
      }
    }

    const zoom = this.map.getZoom();
    if (zoom < MIN_ZOOM_FOR_CATALOG_MARKERS) {
      return result;
    }

    const bounds = this.map.getBounds();
    let catalogCount = 0;
    for (const wp of this.waypoints()) {
      if (seen.has(wp.id)) continue;
      if (!bounds.contains([wp.latitude, wp.longitude])) continue;
      seen.add(wp.id);
      result.push(wp);
      if (++catalogCount >= MAX_CATALOG_MARKERS_IN_VIEW) break;
    }

    return result;
  }

  private refreshMarkers(): void {
    if (!this.map || !this.markersLayer) return;

    this.markersLayer.clearLayers();

    for (const wp of this.waypointsToRender()) {
      const count = this.taskState.getOccurrenceCount(wp.id);
      const selected = count > 0;
      const color = this.markerColor(wp.type);
      const label = selected ? (count > 1 ? `×${count}` : '✓') : '';

      const icon = divIcon({
        className: 'vav-marker',
        html: `<div style="background:${color};color:#fff;border:2px solid ${selected ? '#fbbf24' : '#fff'};border-radius:50%;width:${selected ? 28 : 22}px;height:${selected ? 28 : 22}px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.35);">${label}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      marker([wp.latitude, wp.longitude], { icon })
        .bindTooltip(wp.name, { direction: 'top', offset: [0, -12] })
        .on('click', (ev: LeafletMouseEvent) => {
          ev.originalEvent.stopPropagation();
          this.taskState.addWaypoint(wp.id);
        })
        .addTo(this.markersLayer!);
    }
  }

  private markerColor(type: WaypointType): string {
    switch (type) {
      case 'airfield':
        return '#2563eb';
      case 'landable':
        return '#16a34a';
      case 'custom':
        return '#9333ea';
      default:
        return '#ea580c';
    }
  }

  private updatePolyline(): void {
    if (!this.map) return;

    if (this.taskPolyline) {
      this.taskPolyline.remove();
      this.taskPolyline = null;
    }

    const ids = this.selectedWaypointIds();
    if (ids.length < 2) return;

    const path = ids
      .map(id => this.waypointService.getWaypoint(id))
      .filter((wp): wp is Waypoint => wp !== undefined)
      .map(wp => [wp.latitude, wp.longitude] as [number, number]);

    if (path.length >= 2) {
      this.taskPolyline = polyline(path, {
        color: '#fbbf24',
        weight: 4,
        opacity: 0.95
      }).addTo(this.map);
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

  invalidateSize(): void {
    this.leaflet?.getMap()?.invalidateSize();
  }

  private getMap(): Map | null {
    return this.map ?? this.leaflet?.getMap() ?? null;
  }
}
