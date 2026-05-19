import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { TaskStateService } from '../../../services/task-state.service';
import { TaskRuleEngineService } from '../../../services/task-rule-engine.service';
import { WaypointService } from '../../../services/waypoint.service';
import { FlarmProfileService } from '../../../services/flarm-profile.service';
import { DistanceResult } from '../../../services/distance.service';
import { TaskExportFormat } from '../../../services/task-export.service';
import { TranslateService } from '../../../i18n/translate.service';
import { TranslatePipe } from '../../../i18n/translate.pipe';

@Component({
  selector: 'app-circuit-export-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, Button, InputText, TranslatePipe],
  templateUrl: './circuit-export-panel.component.html',
  styleUrl: './circuit-export-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CircuitExportPanelComponent {
  taskState = inject(TaskStateService);
  private waypointService = inject(WaypointService);
  private ruleEngine = inject(TaskRuleEngineService);
  flarmProfileService = inject(FlarmProfileService);
  private i18n = inject(TranslateService);

  distanceResult = input<DistanceResult | null>(null);

  goToRegulation = output<void>();
  openPilot = output<void>();
  openCircuits = output<void>();
  openPreview = output<void>();
  requestClearTask = output<void>();
  exportFormat = output<TaskExportFormat>();
  downloadFlarm = output<void>();

  selectedWaypointIds = this.taskState.selectedWaypointIds;
  circuitLegs = this.taskState.circuitLegs;
  taskName = this.taskState.taskName;
  resolvedRegulation = this.taskState.resolvedRegulation;
  flarmProfile = this.flarmProfileService.profile;
  waypoints = this.waypointService.waypoints;

  readonly exportFormatActions = computed(() => {
    this.i18n.locale();
    return [
      {
        format: 'flarm' as TaskExportFormat,
        label: 'FLARM',
        detail: this.i18n.t('circuit.export.formatFlarmDetail'),
        icon: 'pi pi-download',
        primary: true
      },
      {
        format: 'cup' as TaskExportFormat,
        label: 'CUP',
        detail: this.i18n.t('circuit.export.formatCupDetail'),
        icon: 'pi pi-file'
      },
      {
        format: 'cupx' as TaskExportFormat,
        label: 'CUPX',
        detail: this.i18n.t('circuit.export.formatCupxDetail'),
        icon: 'pi pi-box'
      },
      {
        format: 'tsk' as TaskExportFormat,
        label: 'XCSoar',
        detail: this.i18n.t('circuit.export.formatTskDetail'),
        icon: 'pi pi-code'
      },
      {
        format: 'igc-crecords' as TaskExportFormat,
        label: 'IGC C-records',
        detail: this.i18n.t('circuit.export.formatIgcDetail'),
        icon: 'pi pi-list'
      }
    ];
  });

  exportStatusText = computed(() => {
    this.i18n.locale();
    if (this.selectedWaypointIds().length === 0) {
      return this.i18n.t('circuit.export.statusEmpty');
    }
    if (this.exportBlocked()) {
      return this.i18n.t('circuit.export.statusBlocked');
    }
    const profileId = this.taskState.regulation().profileId;
    const label = this.i18n.t(`regulation.profiles.${profileId}.label`);
    return this.i18n.t('circuit.export.statusReady', { label });
  });

  regulationProfileLabel = computed(() => {
    this.i18n.locale();
    const profileId = this.taskState.regulation().profileId;
    return this.i18n.t(`regulation.profiles.${profileId}.label`);
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

  onTaskNameChange(value: string): void {
    this.taskState.setTaskName(value);
  }

  onExportClick(format: TaskExportFormat, primary?: boolean): void {
    if (primary) {
      this.downloadFlarm.emit();
    } else {
      this.exportFormat.emit(format);
    }
  }
}
