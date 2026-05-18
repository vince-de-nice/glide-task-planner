import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WaypointService } from '../../services/waypoint.service';
import { Waypoint, WaypointType } from '../../models/waypoint.model';

@Component({
  selector: 'app-waypoint-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './waypoint-manager.component.html',
  styleUrls: ['./waypoint-manager.component.scss']
})
export class WaypointManagerComponent {
  private waypointService = inject(WaypointService);

  waypoints = this.waypointService.waypoints;

  showAddForm = signal(false);
  editingWaypoint = signal<Waypoint | null>(null);
  importMessage = signal<string | null>(null);

  newWaypoint = signal<Partial<Waypoint>>({
    name: '',
    latitude: 0,
    longitude: 0,
    elevation: 0,
    type: 'turnpoint',
    description: ''
  });

  waypointTypes: { value: WaypointType; label: string }[] = [
    { value: 'turnpoint', label: 'Turnpoint' },
    { value: 'airfield', label: 'Aérodrome' },
    { value: 'landable', label: 'Atterrissable' },
    { value: 'custom', label: 'Personnalisé' }
  ];

  toggleAddForm(): void {
    this.showAddForm.update(v => !v);
    if (!this.showAddForm()) {
      this.resetForm();
    }
  }

  saveWaypoint(): void {
    if (!this.newWaypoint().name || !this.newWaypoint().latitude || !this.newWaypoint().longitude) {
      return;
    }

    if (this.editingWaypoint()) {
      this.waypointService.updateWaypoint(this.editingWaypoint()!.id, this.newWaypoint());
      this.editingWaypoint.set(null);
    } else {
      this.waypointService.addWaypoint(this.newWaypoint() as Omit<Waypoint, 'id'>);
    }

    this.resetForm();
    this.showAddForm.set(false);
  }

  editWaypoint(waypoint: Waypoint): void {
    this.editingWaypoint.set(waypoint);
    this.newWaypoint.set({ ...waypoint });
    this.showAddForm.set(true);
  }

  deleteWaypoint(id: string): void {
    if (confirm('Supprimer ce waypoint ?')) {
      this.waypointService.deleteWaypoint(id);
    }
  }

  cancelEdit(): void {
    this.resetForm();
    this.showAddForm.set(false);
    this.editingWaypoint.set(null);
  }

  exportJson(): void {
    const content = this.waypointService.exportWaypoints();
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vav-waypoints-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    this.importMessage.set('Export JSON téléchargé.');
  }

  onImportJson(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const replace = confirm(
          'Remplacer tous les waypoints existants ? (Annuler = fusionner)'
        );
        this.waypointService.importWaypointsFromJson(reader.result as string, replace);
        this.importMessage.set(
          replace ? 'Waypoints remplacés.' : 'Waypoints fusionnés.'
        );
      } catch {
        this.importMessage.set('Fichier JSON invalide.');
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  clearAll(): void {
    if (confirm('Effacer tous les waypoints ? Cette action est irréversible.')) {
      this.waypointService.clearWaypoints();
      this.importMessage.set('Tous les waypoints ont été effacés.');
    }
  }

  typeLabel(type: WaypointType): string {
    return this.waypointTypes.find(t => t.value === type)?.label ?? type;
  }

  private resetForm(): void {
    this.newWaypoint.set({
      name: '',
      latitude: 0,
      longitude: 0,
      elevation: 0,
      type: 'turnpoint',
      description: ''
    });
  }
}
