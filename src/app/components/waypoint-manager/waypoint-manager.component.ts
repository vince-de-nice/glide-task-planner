import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WaypointService } from '../../services/waypoint.service';
import { CupDatabaseService } from '../../services/cup-database.service';
import { CupLoaderService } from '../../services/cup-loader.service';
import { Waypoint, WaypointType } from '../../models/waypoint.model';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';

@Component({
  selector: 'app-waypoint-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, Button, InputText, Select],
  templateUrl: './waypoint-manager.component.html',
  styleUrls: ['./waypoint-manager.component.scss']
})
export class WaypointManagerComponent {
  private waypointService = inject(WaypointService);
  private cupDatabase = inject(CupDatabaseService);
  private cupLoader = inject(CupLoaderService);

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

  readonly waypointTypes: { value: WaypointType; label: string }[] = [
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

  exportCup(): void {
    const content = this.cupDatabase.exportCup();
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.cupDatabase.getSourceLabel().replace(/[^\w.-]+/g, '_') || 'export'}.cup`;
    link.click();
    URL.revokeObjectURL(url);
    this.importMessage.set('Export CUP téléchargé.');
  }

  async onCupFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (this.waypoints().length > 0) {
      const ok = confirm(
        `Importer « ${file.name} » remplacera les points actuels. Continuer ?`
      );
      if (!ok) {
        input.value = '';
        return;
      }
    }

    try {
      await this.cupLoader.loadFromFile(file, true);
      this.importMessage.set('Base CUP importée.');
    } catch {
      this.importMessage.set('Fichier CUP invalide ou illisible.');
    }
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
