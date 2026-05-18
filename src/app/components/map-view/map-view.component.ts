import {
  Component,
  inject,
  input,
  OnDestroy,
  AfterViewInit,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { WaypointService } from '../../services/waypoint.service';
import { TaskStateService } from '../../services/task-state.service';
import { Waypoint, WaypointType } from '../../models/waypoint.model';
import * as L from 'leaflet';

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-view.component.html',
  styleUrls: ['./map-view.component.scss']
})
export class MapViewComponent implements OnDestroy, AfterViewInit {
  private waypointService = inject(WaypointService);
  private taskState = inject(TaskStateService);

  compact = input(false);

  waypoints = this.waypointService.waypoints;
  selectedWaypointIds = this.taskState.selectedWaypointIds;

  private map: L.Map | null = null;
  private markersLayer: L.LayerGroup | null = null;
  private polyline: L.Polyline | null = null;
  private poiPopup: L.Popup | null = null;

  private pendingPoi: { lat: number; lng: number } | null = null;
  poiName = '';

  constructor() {
    effect(() => {
      const _wps = this.waypoints();
      const _sel = this.selectedWaypointIds();
      if (this.map && this.markersLayer) {
        this.refreshMarkers();
        this.updatePolyline();
      }
    });
  }

  ngAfterViewInit(): void {
    this.initializeMap();
    this.refreshMarkers();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private initializeMap(): void {
    const wps = this.waypoints();
    const center: L.LatLngExpression =
      wps.length > 0 ? [wps[0].latitude, wps[0].longitude] : [46.5, 6.5];

    this.map = L.map('declaration-map', {
      center,
      zoom: wps.length > 0 ? 9 : 6,
      zoomControl: true
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 18
    }).addTo(this.map);

    this.markersLayer = L.layerGroup().addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.showPoiPopup(e.latlng.lat, e.latlng.lng);
    });

    setTimeout(() => this.map?.invalidateSize(), 100);
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

  private refreshMarkers(): void {
    if (!this.map || !this.markersLayer) return;

    this.markersLayer.clearLayers();

    for (const wp of this.waypoints()) {
      const count = this.taskState.getOccurrenceCount(wp.id);
      const selected = count > 0;
      const color = this.markerColor(wp.type);
      const label = selected ? (count > 1 ? `×${count}` : '✓') : '';

      const icon = L.divIcon({
        className: 'vav-marker',
        html: `<motion-div style="background:${color};color:#fff;border:2px solid ${selected ? '#fbbf24' : '#fff'};border-radius:50%;width:${selected ? 28 : 22}px;height:${selected ? 28 : 22}px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.35);">${label}</motion-div>`.replaceAll(
          'motion-div',
          'div'
        ),
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([wp.latitude, wp.longitude], { icon })
        .bindTooltip(wp.name, { direction: 'top', offset: [0, -12] })
        .on('click', (ev: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(ev);
          this.taskState.addWaypoint(wp.id);
        });

      this.markersLayer.addLayer(marker);
    }
  }

  private updatePolyline(): void {
    if (!this.map) return;

    if (this.polyline) {
      this.polyline.remove();
      this.polyline = null;
    }

    const ids = this.selectedWaypointIds();
    if (ids.length < 2) return;

    const path: L.LatLngExpression[] = ids
      .map(id => this.waypointService.getWaypoint(id))
      .filter((wp): wp is Waypoint => wp !== undefined)
      .map(wp => [wp.latitude, wp.longitude]);

    if (path.length >= 2) {
      this.polyline = L.polyline(path, {
        color: '#1d4ed8',
        weight: 3,
        opacity: 0.85,
        dashArray: '6 4'
      }).addTo(this.map);
    }
  }

  private showPoiPopup(lat: number, lng: number): void {
    if (!this.map) return;
    this.pendingPoi = { lat, lng };
    this.poiName = '';

    const html = `
      <motion-div class="poi-popup">
        <p><strong>Nouveau point</strong></p>
        <p class="poi-coords">${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
        <input type="text" id="poi-name-input" placeholder="Nom du point" maxlength="32" />
        <motion-div class="poi-actions">
          <button type="button" id="poi-cancel-btn">Annuler</button>
          <button type="button" id="poi-add-btn">Ajouter</button>
        </motion-div>
      </motion-div>
    `.replaceAll('motion-div', 'div');

    this.poiPopup = L.popup({ closeOnClick: true })
      .setLatLng([lat, lng])
      .setContent(html)
      .openOn(this.map);

    setTimeout(() => {
      document.getElementById('poi-cancel-btn')?.addEventListener('click', () => {
        this.map?.closePopup();
        this.pendingPoi = null;
      });
      document.getElementById('poi-add-btn')?.addEventListener('click', () => {
        const input = document.getElementById('poi-name-input') as HTMLInputElement | null;
        const name = input?.value?.trim() || `Point ${lat.toFixed(3)}`;
        if (this.pendingPoi) {
          this.addCustomPoi(name, this.pendingPoi.lat, this.pendingPoi.lng);
        }
        this.map?.closePopup();
        this.pendingPoi = null;
      });
    }, 0);
  }

  private addCustomPoi(name: string, lat: number, lng: number): void {
    const wp = this.waypointService.addWaypoint({
      name,
      latitude: lat,
      longitude: lng,
      type: 'custom'
    });
    this.taskState.addWaypoint(wp.id);
  }

  centerOnTask(): void {
    if (!this.map) return;
    const ids = this.selectedWaypointIds();
    const points = ids
      .map(id => this.waypointService.getWaypoint(id))
      .filter((wp): wp is Waypoint => wp !== undefined);

    if (points.length === 0) {
      this.centerOnAll();
      return;
    }

    if (points.length === 1) {
      this.map.setView([points[0].latitude, points[0].longitude], 11);
      return;
    }

    const bounds = L.latLngBounds(points.map(wp => [wp.latitude, wp.longitude]));
    this.map.fitBounds(bounds, { padding: [40, 40] });
  }

  centerOnAll(): void {
    if (!this.map) return;
    const wps = this.waypoints();
    if (wps.length === 0) return;
    if (wps.length === 1) {
      this.map.setView([wps[0].latitude, wps[0].longitude], 11);
      return;
    }
    const bounds = L.latLngBounds(wps.map(wp => [wp.latitude, wp.longitude]));
    this.map.fitBounds(bounds, { padding: [40, 40] });
  }

  clearSelection(): void {
    this.taskState.clearSelection();
  }

  invalidateSize(): void {
    setTimeout(() => this.map?.invalidateSize(), 150);
  }
}
