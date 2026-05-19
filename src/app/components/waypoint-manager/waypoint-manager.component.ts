import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
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
import { Tooltip } from 'primeng/tooltip';
import { UiFeedbackService } from '../../services/ui-feedback.service';
import {
  filterWaypoints,
  paginateWaypoints,
  sortWaypoints,
  WaypointSortField
} from './waypoint-manager.util';

export type { WaypointSortField };

const SORT_LABELS: Record<WaypointSortField, string> = {
  name: 'nom',
  type: 'type',
  latitude: 'latitude',
  longitude: 'longitude',
  elevation: 'altitude'
};

@Component({
  selector: 'app-waypoint-manager',
  standalone: true,
  imports: [CommonModule, NgTemplateOutlet, FormsModule, RouterLink, Button, InputText, Select, Tooltip],
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

  searchQuery = signal('');
  sortField = signal<WaypointSortField>('name');
  sortDirection = signal<'asc' | 'desc'>('asc');
  currentPage = signal(1);
  pageSize = signal(25);

  readonly pageSizeOptions = [10, 25, 50, 100];
  readonly waypointTypeDisplay = waypointTypeDisplay;

  readonly waypointTypes = WAYPOINT_TYPE_ORDER.map(t => ({
    value: t,
    label: WAYPOINT_TYPE_DISPLAY[t].description,
    icon: WAYPOINT_TYPE_DISPLAY[t].icon
  }));

  filteredWaypoints = computed(() =>
    filterWaypoints(this.waypoints(), this.searchQuery())
  );

  sortedWaypoints = computed(() =>
    sortWaypoints(this.filteredWaypoints(), this.sortField(), this.sortDirection())
  );

  totalWaypointsCount = computed(() => this.waypoints().length);
  totalCount = computed(() => this.sortedWaypoints().length);
  hasActiveSearch = computed(() => this.searchQuery().trim().length > 0);

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalCount() / this.pageSize()))
  );

  paginatedWaypoints = computed(() =>
    paginateWaypoints(
      this.sortedWaypoints(),
      this.currentPage(),
      this.pageSize()
    )
  );

  pageRangeStart = computed(() => {
    if (this.totalCount() === 0) return 0;
    return (Math.min(this.currentPage(), this.totalPages()) - 1) * this.pageSize() + 1;
  });

  pageRangeEnd = computed(() => {
    const end = Math.min(this.currentPage(), this.totalPages()) * this.pageSize();
    return Math.min(end, this.totalCount());
  });

  constructor() {
    effect(() => {
      this.filteredWaypoints();
      this.pageSize();
      const total = this.totalPages();
      if (this.currentPage() > total) {
        this.currentPage.set(total);
      }
    });
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.currentPage.set(1);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.currentPage.set(1);
  }

  toggleSort(field: WaypointSortField): void {
    if (this.sortField() === field) {
      this.sortDirection.update(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
    this.currentPage.set(1);
  }

  sortIcon(field: WaypointSortField): string {
    if (this.sortField() !== field) {
      return 'pi pi-sort-alt';
    }
    return this.sortDirection() === 'asc' ? 'pi pi-sort-up' : 'pi pi-sort-down';
  }

  sortAria(field: WaypointSortField): string {
    const label = SORT_LABELS[field];
    if (this.sortField() !== field) {
      return `Trier par ${label}`;
    }
    return `Tri par ${label}, ${this.sortDirection() === 'asc' ? 'croissant' : 'décroissant'}`;
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    const p = Math.max(1, Math.min(page, this.totalPages()));
    this.currentPage.set(p);
  }

  prevPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  firstPage(): void {
    this.goToPage(1);
  }

  lastPage(): void {
    this.goToPage(this.totalPages());
  }

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
      this.currentPage.set(1);
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
    this.currentPage.set(1);
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
