import {
  Component,
  inject,
  signal,
  computed,
  effect,
  OnInit,
  ViewChild,
  AfterViewInit,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WaypointService } from '../../services/waypoint.service';
import { TaskStateService } from '../../services/task-state.service';
import { CupLoaderService } from '../../services/cup-loader.service';
import { DistanceService, DistanceResult } from '../../services/distance.service';
import {
  FlarmConfigService,
  flarmCfgFilename
} from '../../services/flarm-config.service';
import { MapViewComponent } from '../map-view/map-view.component';
import { CircuitLibraryComponent } from '../circuit-library/circuit-library.component';
import { SavedCircuitService } from '../../services/saved-circuit.service';
import { CupCatalogEntry } from '../../models/cup-catalog.model';
import { FlarmDeclaration } from '../../models/flarm-profile.model';
import { Waypoint, WaypointTypeFilter } from '../../models/waypoint.model';
import { FlarmProfileService } from '../../services/flarm-profile.service';

type MobileTab = 'list' | 'map' | 'task';

@Component({
  selector: 'app-declaration',
  standalone: true,
  imports: [CommonModule, FormsModule, MapViewComponent, CircuitLibraryComponent],
  templateUrl: './declaration.component.html',
  styleUrls: ['./declaration.component.scss']
})
export class DeclarationComponent implements OnInit, AfterViewInit {
  @ViewChild(MapViewComponent) mapView?: MapViewComponent;
  @ViewChild(CircuitLibraryComponent) circuitLibrary?: CircuitLibraryComponent;

  waypointService = inject(WaypointService);
  private taskState = inject(TaskStateService);
  private cupLoader = inject(CupLoaderService);
  private distanceService = inject(DistanceService);
  private flarmConfigService = inject(FlarmConfigService);
  flarmProfileService = inject(FlarmProfileService);
  private savedCircuitService = inject(SavedCircuitService);

  waypoints = this.waypointService.waypoints;
  activeCircuitId = this.savedCircuitService.activeCircuitId;
  selectedWaypointIds = this.taskState.selectedWaypointIds;
  taskName = this.taskState.taskName;
  activeDatabaseId = this.taskState.activeDatabaseId;
  flarmProfile = this.flarmProfileService.profile;

  catalog = signal<CupCatalogEntry[]>([]);
  disclaimer = signal('');
  searchQuery = signal('');
  typeFilter = signal<WaypointTypeFilter>('all');
  currentPage = signal(1);
  pageSize = signal(40);
  mobileTab = signal<MobileTab>('list');
  distanceResult = signal<DistanceResult | null>(null);
  loadError = signal<string | null>(null);
  loading = signal(false);
  copyFeedback = signal(false);
  circuitMessage = signal<string | null>(null);

  selectedWaypoints = computed(() =>
    this.selectedWaypointIds()
      .map(id => this.waypointService.getWaypoint(id))
      .filter((wp): wp is Waypoint => wp !== undefined)
  );

  flarmPreview = computed(() => {
    const wps = this.selectedWaypoints();
    const declaration = this.buildDeclaration();
    if (wps.length === 0 && !this.hasProfileInput()) {
      return '';
    }
    return this.flarmConfigService.generateFlarmCfgTxt(wps, declaration);
  });

  filteredWaypoints = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const filter = this.typeFilter();
    return this.waypoints().filter(wp => {
      if (filter !== 'all' && wp.type !== filter) return false;
      if (!q) return true;
      const haystack = [wp.name, wp.code, wp.description, wp.country]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  });

  filteredCount = computed(() => this.filteredWaypoints().length);

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredCount() / this.pageSize()))
  );

  paginatedWaypoints = computed(() => {
    const all = this.filteredWaypoints();
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize();
    return all.slice(start, start + this.pageSize());
  });

  pageRangeStart = computed(() => {
    if (this.filteredCount() === 0) return 0;
    return (Math.min(this.currentPage(), this.totalPages()) - 1) * this.pageSize() + 1;
  });

  pageRangeEnd = computed(() => {
    const end = Math.min(this.currentPage(), this.totalPages()) * this.pageSize();
    return Math.min(end, this.filteredCount());
  });

  readonly pageSizeOptions = [25, 40, 50, 100];

  constructor() {
    effect(() => {
      this.selectedWaypointIds();
      this.calculateDistance();
    });

    effect(() => {
      this.filteredWaypoints();
      const total = this.totalPages();
      if (this.currentPage() > total) {
        this.currentPage.set(total);
      }
    });
  }

  buildDeclaration(): FlarmDeclaration {
    return {
      ...this.flarmProfile(),
      taskName: this.taskName()
    };
  }

  hasProfileInput(): boolean {
    const p = this.flarmProfile();
    return Boolean(
      p.pilotName.trim() ||
        p.gliderType.trim() ||
        p.gliderId.trim() ||
        p.compId.trim() ||
        p.compClass.trim()
    );
  }

  readonly typeFilters: { id: WaypointTypeFilter; label: string }[] = [
    { id: 'all', label: 'Tous' },
    { id: 'airfield', label: 'Aérodromes' },
    { id: 'landable', label: 'Atterrissables' },
    { id: 'turnpoint', label: 'Turnpoints' },
    { id: 'custom', label: 'Perso' }
  ];

  ngOnInit(): void {
    void this.initCatalog();
  }

  ngAfterViewInit(): void {
    this.calculateDistance();
    setTimeout(() => this.mapView?.invalidateSize(), 350);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.mapView?.invalidateSize();
  }

  private async initCatalog(): Promise<void> {
    try {
      const cat = await this.cupLoader.loadCatalog();
      this.catalog.set(cat.databases);
      this.disclaimer.set(cat.disclaimer);
    } catch {
      this.loadError.set('Catalogue CUP indisponible');
    }
  }

  async onCatalogSelect(event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const id = select.value;
    if (!id) return;
    const entry = this.catalog().find(e => e.id === id);
    if (!entry) return;
    await this.loadDatabase(entry);
    select.value = '';
  }

  async loadDatabase(entry: CupCatalogEntry): Promise<void> {
    if (this.waypoints().length > 0) {
      const ok = confirm(
        `Charger « ${entry.label} » remplacera les ${this.waypoints().length} points actuels. Continuer ?`
      );
      if (!ok) return;
    }
    await this.runLoad(() => this.cupLoader.loadEmbedded(entry, true));
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

    await this.runLoad(() => this.cupLoader.loadFromFile(file, true));
    input.value = '';
  }

  private async runLoad(loader: () => Promise<number>): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const count = await loader();
      if (count === 0) {
        this.loadError.set('Aucun waypoint trouvé dans le fichier');
      }
      this.currentPage.set(1);
      this.calculateDistance();
    } catch (e) {
      this.loadError.set(e instanceof Error ? e.message : 'Échec du chargement');
    } finally {
      this.loading.set(false);
    }
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.currentPage.set(1);
  }

  setTypeFilter(filter: WaypointTypeFilter): void {
    this.typeFilter.set(filter);
    this.currentPage.set(1);
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    const p = Math.max(1, Math.min(page, this.totalPages()));
    this.currentPage.set(p);
    this.scrollWaypointListToTop();
  }

  private scrollWaypointListToTop(): void {
    document.querySelector('.decl-wp-list')?.scrollTo({ top: 0 });
  }

  prevPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  onWaypointRowClick(id: string): void {
    this.taskState.addWaypoint(id);
  }

  moveWaypoint(index: number, direction: 'up' | 'down'): void {
    this.taskState.moveWaypoint(index, direction);
    this.calculateDistance();
  }

  removeFromTask(index: number): void {
    this.taskState.removeWaypointAt(index);
  }

  duplicateWaypoint(index: number): void {
    this.taskState.duplicateWaypointAt(index);
  }

  clearTask(): void {
    this.taskState.clearSelection();
    this.distanceResult.set(null);
  }

  calculateDistance(): void {
    const wps = this.selectedWaypoints();
    if (wps.length >= 2) {
      this.distanceResult.set(this.distanceService.calculateDistance(wps, 'km'));
    } else {
      this.distanceResult.set(null);
    }
  }

  onTaskNameChange(value: string): void {
    this.taskState.setTaskName(value);
  }

  downloadFlarm(): void {
    const wps = this.selectedWaypoints();
    if (wps.length === 0) return;
    const declaration = this.buildDeclaration();
    const filename = flarmCfgFilename(declaration.taskName);
    this.flarmConfigService.downloadFlarmCfg(wps, declaration, filename);
  }

  async copyPreview(): Promise<void> {
    const text = this.flarmPreview();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.copyFeedback.set(true);
      setTimeout(() => this.copyFeedback.set(false), 2000);
    } catch {
      /* fallback ignored */
    }
  }

  canSaveCircuit = computed(() => this.selectedWaypointIds().length >= 2);

  onCircuitSaveRequest(event: { label: string; notes: string; updateId: string | null }): void {
    try {
      this.savedCircuitService.saveCircuit({
        label: event.label || this.taskName(),
        taskName: this.taskName(),
        profile: this.flarmProfile(),
        waypointIds: this.selectedWaypointIds(),
        databaseId: this.activeDatabaseId(),
        notes: event.notes,
        updateId: event.updateId ?? undefined
      });
      this.circuitMessage.set(
        event.updateId ? 'Circuit mis à jour.' : 'Circuit enregistré dans la bibliothèque.'
      );
      this.circuitLibrary?.clearSaveForm();
    } catch (e) {
      this.circuitMessage.set(e instanceof Error ? e.message : 'Enregistrement impossible.');
    }
  }

  onCircuitLoaded(circuitId: string): void {
    const applied = this.savedCircuitService.applyCircuit(circuitId);
    if (!applied) return;
    this.flarmProfileService.updateProfile(applied.profile);
    this.taskState.loadTask(applied.waypointIds, applied.taskName);
    this.calculateDistance();
    this.setMobileTab('task');
    this.circuitMessage.set('Circuit chargé — vérifiez pilote / planeur puis exportez le FLARM.');
  }

  setMobileTab(tab: MobileTab): void {
    this.mobileTab.set(tab);
    if (tab === 'map') {
      setTimeout(() => this.mapView?.invalidateSize(), 200);
    }
  }

  getOccurrenceCount(id: string): number {
    return this.taskState.getOccurrenceCount(id);
  }

  typeLabel(type: Waypoint['type']): string {
    const labels: Record<Waypoint['type'], string> = {
      turnpoint: 'TP',
      airfield: 'AD',
      landable: 'AL',
      custom: 'P'
    };
    return labels[type];
  }
}
