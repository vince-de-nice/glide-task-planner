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
import { SelectButton } from 'primeng/selectbutton';
import { Message } from 'primeng/message';
import { WaypointService } from '../../services/waypoint.service';
import { TaskStateService } from '../../services/task-state.service';
import { CupDatabaseService } from '../../services/cup-database.service';
import { DistanceService, DistanceResult } from '../../services/distance.service';
import {
  TaskExportFormat,
  TaskExportService
} from '../../services/task-export.service';
import { TaskRegulationPanelComponent } from '../task-regulation-panel/task-regulation-panel.component';
import { TaskRuleEngineService } from '../../services/task-rule-engine.service';
import { CircuitPointsPanelComponent } from './circuit-points-panel/circuit-points-panel.component';
import { CircuitExportPanelComponent } from './circuit-export-panel/circuit-export-panel.component';
import { CircuitMapShellComponent } from './circuit-map-shell/circuit-map-shell.component';
import { CupToolbarComponent } from './cup-toolbar/cup-toolbar.component';
import { WaypointPickerDrawerComponent } from './waypoint-picker-drawer/waypoint-picker-drawer.component';
import { PilotProfileDialogComponent } from './pilot-profile-dialog/pilot-profile-dialog.component';
import { TaskExportPreviewDialogComponent } from './task-export-preview-dialog/task-export-preview-dialog.component';
import { CircuitsLibraryDialogComponent } from './circuits-library-dialog/circuits-library-dialog.component';
import { SavedCircuitService } from '../../services/saved-circuit.service';
import { FlarmDeclaration } from '../../models/flarm-profile.model';
import { Waypoint } from '../../models/waypoint.model';
import { FlarmProfileService } from '../../services/flarm-profile.service';
import { UiFeedbackService } from '../../services/ui-feedback.service';
import { CircuitListItem } from '../../models/circuit-list-item.model';
import {
  CircuitLegZoneDialogComponent,
  CircuitLegZoneDialogSave
} from '../circuit-leg-zone-dialog/circuit-leg-zone-dialog.component';
import { buildCircuitListItems } from '../../utils/circuit-list.util';
import { CircuitLeg } from '../../models/circuit.model';

type MobileTab = 'map' | 'task';
type CircuitTab = 'points' | 'regulation' | 'export';

const CIRCUIT_TAB_STORAGE_KEY = 'gc_circuit_tab';

@Component({
  selector: 'app-declaration',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CupToolbarComponent,
    CircuitMapShellComponent,
    CircuitPointsPanelComponent,
    CircuitExportPanelComponent,
    WaypointPickerDrawerComponent,
    PilotProfileDialogComponent,
    TaskExportPreviewDialogComponent,
    CircuitsLibraryDialogComponent,
    SelectButton,
    Message,
    CircuitLegZoneDialogComponent,
    TaskRegulationPanelComponent
  ],
  templateUrl: './declaration.component.html',
  styleUrls: ['./declaration.component.scss']
})
export class DeclarationComponent implements OnInit, AfterViewInit {
  @ViewChild(CircuitMapShellComponent) mapShell?: CircuitMapShellComponent;
  @ViewChild(CircuitsLibraryDialogComponent) circuitsDialog?: CircuitsLibraryDialogComponent;

  private waypointService = inject(WaypointService);
  private taskState = inject(TaskStateService);
  private cupDatabase = inject(CupDatabaseService);
  private distanceService = inject(DistanceService);
  private taskExportService = inject(TaskExportService);
  private flarmProfileService = inject(FlarmProfileService);
  private savedCircuitService = inject(SavedCircuitService);
  private uiFeedback = inject(UiFeedbackService);
  private ruleEngine = inject(TaskRuleEngineService);

  waypoints = this.waypointService.waypoints;
  activeCircuitId = this.savedCircuitService.activeCircuitId;
  selectedWaypointIds = this.taskState.selectedWaypointIds;
  circuitLegs = this.taskState.circuitLegs;
  taskName = this.taskState.taskName;
  flarmProfile = this.flarmProfileService.profile;
  resolvedRegulation = this.taskState.resolvedRegulation;

  mobileTab = signal<MobileTab>('map');
  circuitTab = signal<CircuitTab>('points');
  waypointDialogOpen = signal(false);
  pilotDialogOpen = signal(false);
  previewDialogOpen = signal(false);
  circuitsDialogOpen = signal(false);
  distanceResult = signal<DistanceResult | null>(null);
  circuitMessage = signal<string | null>(null);
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

  circuitListItems = computed(() =>
    buildCircuitListItems(
      this.circuitLegs(),
      id => this.waypointService.getWaypoint(id),
      this.taskState.defaultZoneRadiusM()
    )
  );

  selectedWaypoints = computed(() =>
    this.circuitLegs()
      .map(leg => this.waypointService.getWaypoint(leg.waypointId))
      .filter((wp): wp is Waypoint => wp !== undefined)
  );

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

  canSaveCircuit = computed(() => this.circuitLegs().length >= 2);

  constructor() {
    effect(() => {
      this.circuitLegs();
      this.waypoints();
      this.calculateDistance();
    });
  }

  ngOnInit(): void {
    const storedTab = sessionStorage.getItem(CIRCUIT_TAB_STORAGE_KEY);
    if (storedTab === 'points' || storedTab === 'regulation' || storedTab === 'export') {
      this.circuitTab.set(storedTab);
    }
  }

  ngAfterViewInit(): void {
    this.calculateDistance();
    setTimeout(() => this.mapShell?.mapView?.invalidateSize(), 350);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.mapShell?.mapView?.invalidateSize();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.waypointDialogOpen()) {
      this.closeWaypointDialog();
    } else if (this.previewDialogOpen()) {
      this.previewDialogOpen.set(false);
    } else if (this.pilotDialogOpen()) {
      this.pilotDialogOpen.set(false);
    } else if (this.circuitsDialogOpen()) {
      this.circuitsDialogOpen.set(false);
    }
  }

  onCupDatabaseLoaded(): void {
    this.calculateDistance();
  }

  openWaypointDialog(): void {
    if (this.waypoints().length === 0) return;
    this.waypointDialogOpen.set(true);
  }

  closeWaypointDialog(): void {
    this.waypointDialogOpen.set(false);
    setTimeout(() => this.mapShell?.mapView?.invalidateSize(), 250);
  }

  openPilotDialog(): void {
    this.pilotDialogOpen.set(true);
  }

  openPreviewDialog(): void {
    if (this.selectedWaypointIds().length === 0) return;
    this.previewDialogOpen.set(true);
  }

  openCircuitsDialog(): void {
    this.circuitsDialogOpen.set(true);
  }

  onWaypointDrawerVisible(v: boolean): void {
    if (!v && this.waypointDialogOpen()) {
      this.closeWaypointDialog();
    }
  }

  onPilotDialogVisible(v: boolean): void {
    this.pilotDialogOpen.set(v);
  }

  onPreviewDialogVisible(v: boolean): void {
    this.previewDialogOpen.set(v);
  }

  onCircuitsDialogVisible(v: boolean): void {
    this.circuitsDialogOpen.set(v);
  }

  showAddToast(message: string): void {
    this.uiFeedback.success(message);
  }

  onCircuitLegsReordered(legs: CircuitLeg[]): void {
    this.taskState.setCircuitLegs(legs);
    this.calculateDistance();
  }

  onCircuitItemClick(item: CircuitListItem): void {
    this.mapShell?.mapView?.centerOnWaypoint(item.waypoint.id);
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
    this.mapShell?.mapView?.refreshObservationZones();
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
      this.circuitsDialog?.clearSaveForm();
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
    this.circuitsDialogOpen.set(false);
    this.setMobileTab('task');
    const msg = 'Circuit chargé — vérifiez pilote / planeur puis exportez le FLARM.';
    this.circuitMessage.set(msg);
    this.uiFeedback.info(msg);
    setTimeout(() => this.circuitMessage.set(null), 5000);
  }

  setMobileTab(tab: MobileTab): void {
    this.mobileTab.set(tab);
    if (tab === 'map') {
      setTimeout(() => this.mapShell?.mapView?.invalidateSize(), 50);
      setTimeout(() => this.mapShell?.mapView?.invalidateSize(), 300);
    }
  }

  setCircuitTab(tab: CircuitTab): void {
    this.circuitTab.set(tab);
    sessionStorage.setItem(CIRCUIT_TAB_STORAGE_KEY, tab);
  }

  goToRegulationTab(): void {
    this.setCircuitTab('regulation');
  }

  allowedPresetsForLeg(index: number) {
    const leg = this.circuitLegs()[index];
    if (!leg) return null;
    return this.ruleEngine.allowedPresetsForRole(this.resolvedRegulation(), leg.role);
  }

  private buildDeclaration(): FlarmDeclaration {
    return {
      ...this.flarmProfile(),
      taskName: this.taskName()
    };
  }

  private buildExportContext() {
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
}
