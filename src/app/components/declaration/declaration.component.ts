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
  TaskExportFormat,
  TaskExportService
} from '../../services/task-export.service';
import { TaskRegulationPanelComponent } from '../task-regulation-panel/task-regulation-panel.component';
import { ObsZonePreviewComponent } from '../obs-zone-preview/obs-zone-preview.component';
import { TaskRuleEngineService } from '../../services/task-rule-engine.service';
import { MapViewComponent } from '../map-view/map-view.component';
import { CircuitLibraryComponent } from '../circuit-library/circuit-library.component';
import { SavedCircuitService } from '../../services/saved-circuit.service';
import { FlarmDeclaration } from '../../models/flarm-profile.model';
import { circuitRoleShortLabel } from '../../models/circuit.model';
import { Waypoint, WaypointTypeFilter } from '../../models/waypoint.model';
import { FlarmProfileService } from '../../services/flarm-profile.service';
import { UiFeedbackService } from '../../services/ui-feedback.service';
import { CircuitListItem } from '../../models/circuit-list-item.model';
import {
  CircuitLegZoneDialogComponent,
  CircuitLegZoneDialogSave
} from '../circuit-leg-zone-dialog/circuit-leg-zone-dialog.component';
import { observationZoneShortLabel } from '../../models/observation-zone.model';
import { buildObsZonePreview } from '../../utils/obs-zone-preview.util';
import { formatElevationDisplay, resolveLegElevationM } from '../../utils/elevation.util';
import {
  waypointTypeDisplay,
  WAYPOINT_TYPE_DISPLAY,
  WAYPOINT_TYPE_ORDER
} from '../../utils/waypoint-type-display.util';
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
import { SplitButton } from 'primeng/splitbutton';
import { InputNumber } from 'primeng/inputnumber';
import { MenuItem } from 'primeng/api';

const DISCLAIMER_SEEN_KEY = 'gc_disclaimer_seen';
const DISCLAIMER_LEGACY_KEY = 'vav_disclaimer_seen';

type MobileTab = 'map' | 'task';
type CircuitTab = 'points' | 'regulation' | 'export';

const CIRCUIT_TAB_STORAGE_KEY = 'gc_circuit_tab';

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
    Menu,
    CircuitLegZoneDialogComponent,
    TaskRegulationPanelComponent,
    ObsZonePreviewComponent
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
  private taskExportService = inject(TaskExportService);
  flarmProfileService = inject(FlarmProfileService);
  private savedCircuitService = inject(SavedCircuitService);
  private uiFeedback = inject(UiFeedbackService);
  private ruleEngine = inject(TaskRuleEngineService);

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
  circuitTab = signal<CircuitTab>('points');
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
  previewFormat = signal<TaskExportFormat>('flarm');
  resolvedRegulation = this.taskState.resolvedRegulation;
  legZoneDialogOpen = signal(false);
  legZoneEditIndex = signal(-1);

  legZoneEditLeg = computed(() => {
    const i = this.legZoneEditIndex();
    return i >= 0 ? this.circuitLegs()[i] : undefined;
  });

  legZoneEditWaypoint = computed(() => {
    const leg = this.legZoneEditLeg();
    return leg ? this.waypointService.getWaypoint(leg.waypointId) : undefined;
  });

  legZoneDefaultRadiusM = computed(() => {
    const leg = this.legZoneEditLeg();
    if (!leg) return this.resolvedRegulation().radiiM.turnpointM;
    return this.ruleEngine.radiusForLegRole(this.resolvedRegulation(), leg.role);
  });

  ruleValidation = computed(() => {
    const wpMap = new Map(this.waypoints().map(w => [w.id, w]));
    return this.ruleEngine.validate(
      this.circuitLegs(),
      wpMap,
      this.resolvedRegulation()
    );
  });

  exportBlocked = computed(
    () => !this.ruleValidation().valid && !this.resolvedRegulation().allowExportDespiteErrors
  );

  regulationStatus = computed(() => {
    const v = this.ruleValidation();
    if (v.errors.length > 0) {
      return { kind: 'error' as const, label: `${v.errors.length} erreur(s) de conformité` };
    }
    if (v.warnings.length > 0) {
      return { kind: 'warn' as const, label: `${v.warnings.length} avertissement(s)` };
    }
    return { kind: 'ok' as const, label: 'Circuit conforme au règlement' };
  });

  legComplianceRows = computed(() =>
    this.ruleValidation().legIssues.map(issue => {
      const item = this.circuitListItems()[issue.legIndex];
      return {
        index: issue.legIndex,
        name: item?.waypoint.name ?? `Point ${issue.legIndex + 1}`,
        severity: issue.severity,
        message: issue.message
      };
    })
  );

  pilotSummary = computed(() => {
    const p = this.flarmProfile();
    const parts = [
      p.pilotName.trim(),
      p.gliderType.trim(),
      p.gliderId.trim() || p.compId.trim(),
      p.compClass.trim() ? `cl. ${p.compClass.trim()}` : ''
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : null;
  });

  readonly exportFormatActions: {
    format: TaskExportFormat;
    label: string;
    detail: string;
    icon: string;
    primary?: boolean;
  }[] = [
      {
        format: 'flarm',
        label: 'FLARM',
        detail: 'flarmcfg.txt — SD/USB',
        icon: 'pi pi-download',
        primary: true
      },
      { format: 'cup', label: 'CUP', detail: 'Waypoints + tâche', icon: 'pi pi-file' },
      { format: 'cupx', label: 'CUPX', detail: 'Archive POINTS.CUP', icon: 'pi pi-box' },
      { format: 'tsk', label: 'XCSoar', detail: 'Fichier .tsk', icon: 'pi pi-code' },
      { format: 'igc-crecords', label: 'IGC C-records', detail: 'Trace déclarée', icon: 'pi pi-list' }
    ];

  circuitListItems = computed(() => {
    const legs = this.circuitLegs();
    const defaultR = this.taskState.defaultZoneRadiusM();
    const depLeg = legs.find(l => l.role === 'departure');
    const departureWp = depLeg
      ? (this.waypointService.getWaypoint(depLeg.waypointId) ?? null)
      : null;

    return legs.flatMap((leg, index): CircuitListItem[] => {
      const wp = this.waypointService.getWaypoint(leg.waypointId);
      if (!wp) return [];

      const prev = index > 0
        ? (this.waypointService.getWaypoint(legs[index - 1].waypointId) ?? null)
        : null;
      const next = index < legs.length - 1
        ? (this.waypointService.getWaypoint(legs[index + 1].waypointId) ?? null)
        : null;

      const previewView = buildObsZonePreview({
        legIndex: index,
        leg,
        waypoint: wp,
        prev,
        next,
        departure: departureWp,
        defaultRadiusM: defaultR
      });

      return [{
        leg,
        waypoint: wp,
        legIndex: index,
        previewView,
        key: `${index}-${leg.waypointId}-${leg.role}`
      }];
    });
  });

  selectedWaypoints = computed(() =>
    this.circuitLegs()
      .map(leg => this.waypointService.getWaypoint(leg.waypointId))
      .filter((wp): wp is Waypoint => wp !== undefined)
  );

  flarmPreview = computed(() => {
    if (this.selectedWaypointIds().length === 0 && !this.hasProfileInput()) {
      return '';
    }
    return this.taskExportService.preview('flarm', this.buildExportContext());
  });

  exportPreview = computed(() => {
    if (this.selectedWaypointIds().length === 0) {
      return '';
    }
    const fmt = this.previewFormat();
    if (fmt === 'cupx') {
      const cup = this.taskExportService.preview('cup', this.buildExportContext());
      if (!cup) return '';
      return `[Contenu POINTS.CUP — le fichier .cupx est une archive binaire]\n\n${cup}`;
    }
    return this.taskExportService.preview(fmt, this.buildExportContext());
  });

  readonly previewFormatOptions: { label: string; value: TaskExportFormat }[] = [
    { label: 'FLARM (flarmcfg.txt)', value: 'flarm' },
    { label: 'CUP avec tâche', value: 'cup' },
    { label: 'CUPX (POINTS.CUP)', value: 'cupx' },
    { label: 'XCSoar (.tsk)', value: 'tsk' },
    { label: 'IGC C-records', value: 'igc-crecords' }
  ];

  exportMenuItems = computed<MenuItem[]>(() => [
    {
      label: 'CUP avec tâche (.cup)',
      icon: 'pi pi-file',
      disabled: this.selectedWaypointIds().length === 0,
      command: () => void this.exportTask('cup')
    },
    {
      label: 'CUPX (.cupx)',
      icon: 'pi pi-box',
      disabled: this.selectedWaypointIds().length === 0,
      command: () => void this.exportTask('cupx')
    },
    {
      label: 'XCSoar (.tsk)',
      icon: 'pi pi-code',
      disabled: this.selectedWaypointIds().length === 0,
      command: () => void this.exportTask('tsk')
    },
    {
      label: 'IGC C-records (.txt)',
      icon: 'pi pi-list',
      disabled: this.selectedWaypointIds().length === 0,
      command: () => void this.exportTask('igc-crecords')
    }
  ]);

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

  circuitTabOptionsUi = computed(() => {
    const errCount = this.ruleValidation().errors.length;
    const blocked = this.exportBlocked();
    return [
      { label: 'Points', value: 'points' as CircuitTab },
      {
        label: errCount > 0 ? `Règlement (${errCount})` : 'Règlement',
        value: 'regulation' as CircuitTab
      },
      { label: blocked ? 'Export · bloqué' : 'Export', value: 'export' as CircuitTab }
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

  buildExportContext() {
    const reg = this.resolvedRegulation();
    return {
      legs: this.circuitLegs(),
      waypoints: this.waypoints(),
      taskName: this.taskName(),
      flarmDeclaration: this.buildDeclaration(),
      options: {
        defaultRadiusM: reg.radiiM.turnpointM,
        regulation: reg
      }
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

  readonly waypointTypeDisplay = waypointTypeDisplay;

  readonly typeFilters: { id: WaypointTypeFilter; label: string; icon: string }[] = [
    { id: 'all', label: 'Tous', icon: 'pi pi-list' },
    ...WAYPOINT_TYPE_ORDER.map(t => ({
      id: t as WaypointTypeFilter,
      label: WAYPOINT_TYPE_DISPLAY[t].label,
      icon: WAYPOINT_TYPE_DISPLAY[t].icon
    }))
  ];

  readonly observationZoneShortLabel = observationZoneShortLabel;

  legZoneShort(item: CircuitListItem): string {
    const leg = item.leg;
    const zone = leg.obsZone;
    const zoneTxt = zone ? observationZoneShortLabel(zone) : '—';
    const elev = formatElevationDisplay(resolveLegElevationM(item.waypoint, leg));
    return `${zoneTxt} · ${elev}`;
  }

  legIssueMessage(index: number): string | null {
    const issue = this.ruleEngine.getLegIssue(index, this.ruleValidation());
    return issue?.message ?? null;
  }

  legComplianceSeverity(index: number): 'ok' | 'warn' | 'error' | null {
    const issue = this.ruleEngine.getLegIssue(index, this.ruleValidation());
    if (!issue) return 'ok';
    return issue.severity === 'warning' ? 'warn' : issue.severity;
  }

  legComplianceIcon(index: number): string | null {
    const sev = this.legComplianceSeverity(index);
    if (sev === 'error') return 'pi pi-times-circle';
    if (sev === 'warn') return 'pi pi-exclamation-triangle';
    return null;
  }

  legComplianceTooltip(index: number): string {
    return this.legIssueMessage(index) ?? 'Conforme au règlement';
  }

  allowedPresetsForLeg(index: number) {
    const leg = this.circuitLegs()[index];
    if (!leg) return null;
    return this.ruleEngine.allowedPresetsForRole(this.resolvedRegulation(), leg.role);
  }

  ngOnInit(): void {
    this.cupPanelExpanded.set(this.waypoints().length === 0);
    if (!this.isDisclaimerSeen() && this.disclaimer()) {
      this.disclaimerAccordionIndex.set(0);
    }
    const storedTab = sessionStorage.getItem(CIRCUIT_TAB_STORAGE_KEY);
    if (storedTab === 'points' || storedTab === 'regulation' || storedTab === 'export') {
      this.circuitTab.set(storedTab);
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
    if (this.selectedWaypointIds().length === 0) return;
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

  private isDisclaimerSeen(): boolean {
    if (localStorage.getItem(DISCLAIMER_SEEN_KEY)) return true;
    if (!localStorage.getItem(DISCLAIMER_LEGACY_KEY)) return false;
    localStorage.setItem(DISCLAIMER_SEEN_KEY, '1');
    localStorage.removeItem(DISCLAIMER_LEGACY_KEY);
    return true;
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

  openLegZoneDialog(index: number, event?: Event): void {
    event?.stopPropagation();
    this.legZoneEditIndex.set(index);
    this.legZoneDialogOpen.set(true);
  }

  onLegZoneDialogVisible(v: boolean): void {
    this.legZoneDialogOpen.set(v);
    if (!v) {
      this.legZoneEditIndex.set(-1);
    }
  }

  onLegZoneSaved(data: CircuitLegZoneDialogSave): void {
    const i = this.legZoneEditIndex();
    if (i < 0) return;
    this.taskState.patchLegZone(i, {
      obsZone: data.obsZone,
      elevationM: data.elevationM
    });
    this.mapView?.refreshObservationZones();
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
    const label = this.cupDatabase.getSourceLabel().replace(/[^\w.-]+/g, '_') || 'circuit-export';
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
    void this.exportTask('flarm');
  }

  async exportTask(format: TaskExportFormat): Promise<void> {
    if (this.selectedWaypointIds().length === 0) return;
    const result = await this.taskExportService.download(format, this.buildExportContext());
    if ('error' in result) {
      this.uiFeedback.error('Export impossible', result.error);
      return;
    }
    const warn = result.warnings;
    if (warn.length > 0) {
      this.uiFeedback.info(
        'Export terminé',
        warn.slice(0, 3).join(' ') + (warn.length > 3 ? '…' : '')
      );
    } else {
      this.uiFeedback.success('Fichier exporté');
    }
  }

  async copyPreview(): Promise<void> {
    const text = this.exportPreview();
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
        regulation: this.taskState.regulation(),
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
    this.taskState.loadTask(
      applied.circuitLegs,
      applied.taskName,
      applied.regulation
    );
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

  setCircuitTab(tab: CircuitTab): void {
    this.circuitTab.set(tab);
    sessionStorage.setItem(CIRCUIT_TAB_STORAGE_KEY, tab);
  }

  goToRegulationTab(): void {
    this.setCircuitTab('regulation');
  }

  getOccurrenceCount(id: string): number {
    return this.taskState.getOccurrenceCount(id);
  }

  circuitRoleLabel = circuitRoleShortLabel;

}
