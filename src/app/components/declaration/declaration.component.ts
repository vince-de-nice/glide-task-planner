import {
  Component,
  inject,
  signal,
  computed,
  effect,
  OnInit,
  ViewChild,
  ElementRef,
  AfterViewInit,
  HostListener
} from '@angular/core';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WaypointService } from '../../services/waypoint.service';
import { TaskStateService } from '../../services/task-state.service';
import { CupLoaderService } from '../../services/cup-loader.service';
import { CupDatabaseService } from '../../services/cup-database.service';
import { CupSourcesConfigService } from '../../services/cup-sources-config.service';
import { CupSourceEntry } from '../../models/cup-sources.model';
import {
  DistanceService,
  DistanceResult,
  TaskLegDistance
} from '../../services/distance.service';
import {
  FlarmConfigService,
  flarmCfgFilename
} from '../../services/flarm-config.service';
import { MapViewComponent } from '../map-view/map-view.component';
import { CircuitLibraryComponent } from '../circuit-library/circuit-library.component';
import { SavedCircuitService } from '../../services/saved-circuit.service';
import { FlarmDeclaration } from '../../models/flarm-profile.model';
import { circuitRoleShortLabel } from '../../models/circuit.model';
import { Waypoint, WaypointTypeFilter } from '../../models/waypoint.model';
import { FlarmProfileService } from '../../services/flarm-profile.service';
import { UiFeedbackService } from '../../services/ui-feedback.service';
import { CircuitListItem } from '../../models/circuit-list-item.model';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { InputText } from 'primeng/inputtext';
import { SelectButton } from 'primeng/selectbutton';
import { Dialog } from 'primeng/dialog';
import { Drawer } from 'primeng/drawer';
import { Tooltip } from 'primeng/tooltip';
import { Textarea } from 'primeng/textarea';
import { Tag } from 'primeng/tag';
import { Message } from 'primeng/message';
import { Accordion, AccordionPanel, AccordionHeader, AccordionContent } from 'primeng/accordion';
import { Menu } from 'primeng/menu';
import { MenuItem } from 'primeng/api';

const DISCLAIMER_SEEN_KEY = 'vav_disclaimer_seen';

type MobileTab = 'map' | 'task';

interface WorkflowStepUi {
  label: string;
  done: boolean;
  active: boolean;
}

@Component({
  selector: 'app-declaration',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MapViewComponent,
    CircuitLibraryComponent,
    Button,
    Select,
    InputText,
    SelectButton,
    Dialog,
    Drawer,
    Tooltip,
    Textarea,
    Tag,
    Message,
    Accordion,
    AccordionPanel,
    AccordionHeader,
    AccordionContent,
    DragDropModule,
    Menu
  ],
  templateUrl: './declaration.component.html',
  styleUrls: ['./declaration.component.scss']
})
export class DeclarationComponent implements OnInit, AfterViewInit {
  @ViewChild(MapViewComponent) mapView?: MapViewComponent;
  @ViewChild(CircuitLibraryComponent) circuitLibrary?: CircuitLibraryComponent;

  waypointService = inject(WaypointService);
  private taskState = inject(TaskStateService);
  private cupLoader = inject(CupLoaderService);
  private cupDatabase = inject(CupDatabaseService);
  private cupSourcesConfig = inject(CupSourcesConfigService);
  private distanceService = inject(DistanceService);
  private flarmConfigService = inject(FlarmConfigService);
  flarmProfileService = inject(FlarmProfileService);
  private savedCircuitService = inject(SavedCircuitService);
  private uiFeedback = inject(UiFeedbackService);

  waypoints = this.waypointService.waypoints;
  activeCircuitId = this.savedCircuitService.activeCircuitId;
  selectedWaypointIds = this.taskState.selectedWaypointIds;
  circuitLegs = this.taskState.circuitLegs;
  taskName = this.taskState.taskName;
  flarmProfile = this.flarmProfileService.profile;
  cupMeta = this.cupDatabase.meta;

  cupSources = signal<CupSourceEntry[]>([]);
  cupQuickSourcePick = signal<string | null>(null);
  cupUrlInput = signal('');
  disclaimer = signal('');
  searchQuery = signal('');
  typeFilter = signal<WaypointTypeFilter>('all');
  currentPage = signal(1);
  pageSize = signal(40);
  mobileTab = signal<MobileTab>('map');
  waypointDialogOpen = signal(false);
  pilotDialogOpen = signal(false);
  previewDialogOpen = signal(false);
  circuitsDialogOpen = signal(false);
  distanceResult = signal<DistanceResult | null>(null);
  loadError = signal<string | null>(null);
  loading = signal(false);
  copyFeedback = signal(false);
  circuitMessage = signal<string | null>(null);
  cupPanelExpanded = signal(false);
  disclaimerAccordionIndex = signal<number | number[] | string | string[] | null>(-1);

  circuitListItems = computed(() =>
    this.circuitLegs().flatMap((leg, index) => {
      const wp = this.waypointService.getWaypoint(leg.waypointId);
      if (!wp) {
        return [];
      }
      return [
        {
          leg,
          waypoint: wp,
          key: `${index}-${leg.waypointId}-${leg.role}`
        }
      ];
    })
  );

  selectedWaypoints = computed(() =>
    this.circuitLegs()
      .map(leg => this.waypointService.getWaypoint(leg.waypointId))
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

  mobileTabOptionsUi = computed(() => {
    const n = this.selectedWaypointIds().length;
    return [
      { label: 'Carte', value: 'map' as MobileTab },
      { label: n > 0 ? `Circuit (${n})` : 'Circuit', value: 'task' as MobileTab }
    ];
  });

  workflowSteps = computed((): WorkflowStepUi[] => {
    const hasBase = this.waypoints().length > 0;
    const hasCircuit = this.selectedWaypointIds().length >= 2;
    const canExport = hasCircuit && Boolean(this.flarmPreview());
    return [
      { label: 'Base', done: hasBase, active: !hasBase },
      { label: 'Circuit', done: hasCircuit, active: hasBase && !hasCircuit },
      { label: 'Export', done: canExport, active: hasCircuit && !canExport }
    ];
  });

  cupMenuItems = computed<MenuItem[]>(() => [
    {
      label: 'Importer .cup',
      icon: 'pi pi-upload',
      command: () => this.cupFileInput?.nativeElement.click()
    },
    {
      label: 'Exporter .cup',
      icon: 'pi pi-file-export',
      disabled: this.waypoints().length === 0,
      command: () => this.exportCup()
    }
  ]);

  constructor() {
    effect(() => {
      this.circuitLegs();
      this.waypoints();
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

  @ViewChild('cupFileInput') cupFileInput?: ElementRef<HTMLInputElement>;

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
    this.cupPanelExpanded.set(this.waypoints().length === 0);
    if (!localStorage.getItem(DISCLAIMER_SEEN_KEY) && this.disclaimer()) {
      this.disclaimerAccordionIndex.set(0);
    }
    void this.initCupSources();
  }

  ngAfterViewInit(): void {
    this.calculateDistance();
    setTimeout(() => this.mapView?.invalidateSize(), 350);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.mapView?.invalidateSize();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.waypointDialogOpen()) {
      this.closeWaypointDialog();
    } else if (this.previewDialogOpen()) {
      this.closePreviewDialog();
    } else if (this.pilotDialogOpen()) {
      this.closePilotDialog();
    } else if (this.circuitsDialogOpen()) {
      this.closeCircuitsDialog();
    }
  }

  openWaypointDialog(): void {
    if (this.waypoints().length === 0) return;
    this.waypointDialogOpen.set(true);
  }

  closeWaypointDialog(): void {
    this.waypointDialogOpen.set(false);
    setTimeout(() => this.mapView?.invalidateSize(), 250);
  }

  openPilotDialog(): void {
    this.pilotDialogOpen.set(true);
  }

  closePilotDialog(): void {
    this.pilotDialogOpen.set(false);
  }

  openPreviewDialog(): void {
    if (!this.flarmPreview()) return;
    this.previewDialogOpen.set(true);
  }

  closePreviewDialog(): void {
    this.previewDialogOpen.set(false);
  }

  openCircuitsDialog(): void {
    this.circuitsDialogOpen.set(true);
  }

  closeCircuitsDialog(): void {
    this.circuitsDialogOpen.set(false);
  }

  onWaypointDrawerVisible(v: boolean): void {
    if (!v && this.waypointDialogOpen()) {
      this.closeWaypointDialog();
    }
  }

  onPilotDialogVisible(v: boolean): void {
    if (!v) {
      this.closePilotDialog();
    }
  }

  onPreviewDialogVisible(v: boolean): void {
    if (!v) {
      this.closePreviewDialog();
    }
  }

  onCircuitsDialogVisible(v: boolean): void {
    if (!v) {
      this.closeCircuitsDialog();
    }
  }

  showAddToast(message: string): void {
    this.uiFeedback.success(message);
  }

  toggleCupPanel(): void {
    this.cupPanelExpanded.update(v => !v);
  }

  onDisclaimerToggle(index: number | number[] | string | string[] | null | undefined): void {
    this.disclaimerAccordionIndex.set(index ?? null);
    const values = Array.isArray(index) ? index : index == null ? [] : [index];
    if (values.some(v => v === 0 || v === '0')) {
      localStorage.setItem(DISCLAIMER_SEEN_KEY, '1');
    }
  }

  onCircuitDrop(event: CdkDragDrop<CircuitListItem[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    const items = [...this.circuitListItems()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.taskState.setCircuitLegs(items.map(i => i.leg));
    this.calculateDistance();
  }

  onCircuitItemClick(item: CircuitListItem): void {
    this.mapView?.centerOnWaypoint(item.waypoint.id);
  }

  removeCircuitItem(index: number): void {
    this.taskState.removeWaypointAt(index);
    this.calculateDistance();
  }

  async clearTaskWithConfirm(): Promise<void> {
    if (this.selectedWaypointIds().length === 0) return;
    const ok = await this.uiFeedback.confirm({
      header: 'Vider la tâche',
      message: 'Retirer tous les points du circuit ?',
      acceptLabel: 'Vider',
      rejectLabel: 'Annuler',
      acceptButtonStyleClass: 'p-button-danger'
    });
    if (ok) {
      this.clearTask();
    }
  }

  private async initCupSources(): Promise<void> {
    try {
      const config = await this.cupSourcesConfig.loadConfig();
      this.disclaimer.set(config.disclaimer);
      const merged = this.cupSourcesConfig.mergeWithRecents(
        config,
        this.cupDatabase.getRecentUrls()
      );
      this.cupSources.set(merged);
    } catch {
      this.loadError.set('Configuration des sources CUP indisponible');
    }
  }

  async onCupQuickPickChange(url: string | null): Promise<void> {
    this.cupQuickSourcePick.set(url);
    if (!url?.trim()) {
      return;
    }
    const entry = this.cupSources().find(s => s.url === url);
    try {
      await this.loadFromUrl(url, entry?.label);
    } finally {
      this.cupQuickSourcePick.set(null);
    }
  }

  async loadFromUrlInput(): Promise<void> {
    const url = this.cupUrlInput().trim();
    if (!url) return;
    await this.loadFromUrl(url);
  }

  private async loadFromUrl(url: string, label?: string): Promise<void> {
    if (this.waypoints().length > 0) {
      const ok = await this.uiFeedback.confirm({
        header: 'Remplacer la base',
        message: `Charger cette base remplacera les ${this.waypoints().length} points actuels. Continuer ?`
      });
      if (!ok) return;
    }
    await this.runLoad(() => this.cupLoader.loadFromUrl(url, label, true));
    this.cupUrlInput.set(url);
    this.cupPanelExpanded.set(false);
    void this.initCupSources();
  }

  exportCup(): void {
    const content = this.cupDatabase.exportCup();
    const label = this.cupDatabase.getSourceLabel().replace(/[^\w.-]+/g, '_') || 'vav-export';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${label}.cup`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async onCupFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (this.waypoints().length > 0) {
      const ok = await this.uiFeedback.confirm({
        header: 'Remplacer la base',
        message: `Importer « ${file.name} » remplacera les points actuels. Continuer ?`
      });
      if (!ok) {
        input.value = '';
        return;
      }
    }

    await this.runLoad(() => this.cupLoader.loadFromFile(file, true));
    this.cupPanelExpanded.set(false);
    input.value = '';
  }

  private async runLoad(loader: () => Promise<number>): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const count = await loader();
      if (count === 0) {
        this.loadError.set('Aucun waypoint trouvé dans le fichier');
      } else {
        this.uiFeedback.success('Base CUP chargée', `${count} point(s)`);
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

  onWaypointRowClick(id: string, name: string): void {
    this.taskState.addTurnpoint(id);
    this.showAddToast(`« ${name} » ajouté comme point de virage`);
  }

  moveWaypoint(index: number, direction: 'up' | 'down'): void {
    this.taskState.moveWaypoint(index, direction);
    this.calculateDistance();
  }

  removeFromTask(index: number): void {
    this.taskState.removeWaypointAt(index);
  }

  clearTask(): void {
    this.taskState.clearSelection();
    this.distanceResult.set(null);
  }

  calculateDistance(): void {
    const wps = this.selectedWaypoints();
    if (wps.length >= 2) {
      this.distanceResult.set(
        this.distanceService.calculateTaskDistance(wps, 'km', this.taskState.getCircuitRoles())
      );
    } else {
      this.distanceResult.set(null);
    }
  }

  legFromIndex(index: number): TaskLegDistance | undefined {
    return this.distanceResult()?.legDistances.find(leg => leg.fromIndex === index);
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

  canSaveCircuit = computed(() => this.circuitLegs().length >= 2);

  onCircuitSaveRequest(event: { label: string; notes: string; updateId: string | null }): void {
    try {
      this.savedCircuitService.saveCircuit({
        label: event.label || this.taskName(),
        taskName: this.taskName(),
        profile: this.flarmProfile(),
        circuitLegs: this.circuitLegs(),
        sourceUrl: this.cupDatabase.getSourceUrl(),
        notes: event.notes,
        updateId: event.updateId ?? undefined
      });
      const msg = event.updateId ? 'Circuit mis à jour.' : 'Circuit enregistré dans la bibliothèque.';
      this.circuitMessage.set(msg);
      this.uiFeedback.success(msg);
      this.circuitLibrary?.clearSaveForm();
    } catch (e) {
      this.circuitMessage.set(e instanceof Error ? e.message : 'Enregistrement impossible.');
    }
  }

  onCircuitLoaded(circuitId: string): void {
    const applied = this.savedCircuitService.applyCircuit(circuitId);
    if (!applied) return;
    this.flarmProfileService.updateProfile(applied.profile);
    this.taskState.loadTask(applied.circuitLegs, applied.taskName);
    this.calculateDistance();
    this.closeCircuitsDialog();
    this.setMobileTab('task');
    const msg = 'Circuit chargé — vérifiez pilote / planeur puis exportez le FLARM.';
    this.circuitMessage.set(msg);
    this.uiFeedback.info(msg);
    setTimeout(() => this.circuitMessage.set(null), 5000);
  }

  setMobileTab(tab: MobileTab): void {
    this.mobileTab.set(tab);
    if (tab === 'map') {
      setTimeout(() => this.mapView?.invalidateSize(), 50);
      setTimeout(() => this.mapView?.invalidateSize(), 300);
    }
  }

  getOccurrenceCount(id: string): number {
    return this.taskState.getOccurrenceCount(id);
  }

  circuitRoleLabel = circuitRoleShortLabel;

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
