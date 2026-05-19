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

@Component({
  selector: 'app-circuit-export-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, Button, InputText],
  templateUrl: './circuit-export-panel.component.html',
  styleUrl: './circuit-export-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CircuitExportPanelComponent {
  private taskState = inject(TaskStateService);
  private waypointService = inject(WaypointService);
  private ruleEngine = inject(TaskRuleEngineService);
  flarmProfileService = inject(FlarmProfileService);

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
