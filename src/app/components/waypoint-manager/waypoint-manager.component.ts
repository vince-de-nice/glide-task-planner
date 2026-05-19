import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WaypointService } from '../../services/waypoint.service';
import { CupDatabaseService } from '../../services/cup-database.service';
import { CupLoaderService } from '../../services/cup-loader.service';
import { Waypoint } from '../../models/waypoint.model';
import {
  waypointTypeDisplay,
  WAYPOINT_TYPE_DISPLAY,
  WAYPOINT_TYPE_ORDER
} from '../../utils/waypoint-type-display.util';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { UiFeedbackService } from '../../services/ui-feedback.service';

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
  private uiFeedback = inject(UiFeedbackService);

  waypoints = this.waypointService.waypoints;

  showAddForm = signal(false);
  editingWaypoint = signal<Waypoint | null>(null);
  newWaypoint = signal<Partial<Waypoint>>({
    name: '',
    latitude: 0,
    longitude: 0,
    elevation: 0,
    type: 'turnpoint',
    description: ''
  });

  readonly waypointTypeDisplay = waypointTypeDisplay;

  readonly waypointTypes = WAYPOINT_TYPE_ORDER.map(t => ({
    value: t,
    label: WAYPOINT_TYPE_DISPLAY[t].description,
    icon: WAYPOINT_TYPE_DISPLAY[t].icon
  }));

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

  async deleteWaypoint(id: string): Promise<void> {
    const ok = await this.uiFeedback.confirm({
      header: 'Supprimer le waypoint',
      message: 'Supprimer ce waypoint ?',
      acceptLabel: 'Supprimer',
      acceptButtonStyleClass: 'p-button-danger'
    });
    if (!ok) return;
    this.waypointService.deleteWaypoint(id);
    this.uiFeedback.success('Waypoint supprimé');
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
    this.uiFeedback.success('Export CUP téléchargé');
  }

  async onCupFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (this.waypoints().length > 0) {
      const ok = await this.uiFeedback.confirm({
        header: 'Importer la base CUP',
        message: `Importer « ${file.name} » remplacera les points actuels. Continuer ?`,
        acceptLabel: 'Importer'
      });
      if (!ok) {
        input.value = '';
        return;
      }
    }

    try {
      await this.cupLoader.loadFromFile(file, true);
      this.uiFeedback.success('Base CUP importée');
    } catch {
      this.uiFeedback.error('Fichier CUP invalide ou illisible');
    }
    input.value = '';
  }

  async clearAll(): Promise<void> {
    const ok = await this.uiFeedback.confirm({
      header: 'Effacer tous les waypoints',
      message: 'Effacer tous les waypoints ? Cette action est irréversible.',
      acceptLabel: 'Tout effacer',
      acceptButtonStyleClass: 'p-button-danger'
    });
    if (!ok) return;
    this.waypointService.clearWaypoints();
    this.uiFeedback.success('Tous les waypoints ont été effacés');
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
