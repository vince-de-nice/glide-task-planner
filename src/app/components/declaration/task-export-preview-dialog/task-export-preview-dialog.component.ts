import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { Message } from 'primeng/message';
import {
  TaskExportFormat,
  TaskExportService
} from '../../../services/task-export.service';
import { TaskStateService } from '../../../services/task-state.service';
import { TaskRuleEngineService } from '../../../services/task-rule-engine.service';
import { WaypointService } from '../../../services/waypoint.service';
import { FlarmProfileService } from '../../../services/flarm-profile.service';
import { FlarmDeclaration } from '../../../models/flarm-profile.model';
import { TranslateService } from '../../../i18n/translate.service';
import { TranslatePipe } from '../../../i18n/translate.pipe';

@Component({
  selector: 'app-task-export-preview-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, Dialog, Button, Select, Textarea, Message, TranslatePipe],
  templateUrl: './task-export-preview-dialog.component.html',
  styleUrl: './task-export-preview-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskExportPreviewDialogComponent {
  private taskExportService = inject(TaskExportService);
  private taskState = inject(TaskStateService);
  private waypointService = inject(WaypointService);
  private ruleEngine = inject(TaskRuleEngineService);
  private flarmProfileService = inject(FlarmProfileService);
  private i18n = inject(TranslateService);

  visible = input(false);
  visibleChange = output<boolean>();
  downloadRequested = output<TaskExportFormat>();

  previewFormat = signal<TaskExportFormat>('flarm');
  copyFeedback = signal(false);

  circuitLegs = this.taskState.circuitLegs;
  taskName = this.taskState.taskName;
  waypoints = this.waypointService.waypoints;
  selectedWaypointIds = this.taskState.selectedWaypointIds;
  resolvedRegulation = this.taskState.resolvedRegulation;
  flarmProfile = this.flarmProfileService.profile;

  readonly previewFormatOptions = computed(() => {
    this.i18n.locale();
    return [
      { label: this.i18n.t('preview.formatFlarm'), value: 'flarm' as TaskExportFormat },
      { label: this.i18n.t('preview.formatCup'), value: 'cup' as TaskExportFormat },
      { label: this.i18n.t('preview.formatCupx'), value: 'cupx' as TaskExportFormat },
      { label: this.i18n.t('preview.formatTsk'), value: 'tsk' as TaskExportFormat },
      { label: this.i18n.t('preview.formatIgc'), value: 'igc-crecords' as TaskExportFormat }
    ];
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

  exportPreview = computed(() => {
    this.i18n.locale();
    if (this.selectedWaypointIds().length === 0) {
      return '';
    }
    const fmt = this.previewFormat();
    const ctx = this.buildExportContext();
    if (fmt === 'cupx') {
      const cup = this.taskExportService.preview('cup', ctx);
      if (!cup) return '';
      const note = this.i18n.t('preview.cupArchiveNote');
      return `${note}\n\n${cup}`;
    }
    return this.taskExportService.preview(fmt, ctx);
  });

  onVisibleChange(v: boolean): void {
    this.visibleChange.emit(v);
  }

  close(): void {
    this.visibleChange.emit(false);
  }

  async copyPreview(): Promise<void> {
    const text = this.exportPreview();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.copyFeedback.set(true);
      setTimeout(() => this.copyFeedback.set(false), 2000);
    } catch {
      /* ignored */
    }
  }

  requestDownload(): void {
    this.downloadRequested.emit(this.previewFormat());
    this.close();
  }

  private buildExportContext() {
    const reg = this.resolvedRegulation();
    const declaration: FlarmDeclaration = {
      ...this.flarmProfile(),
      taskName: this.taskName()
    };
    return {
      legs: this.circuitLegs(),
      waypoints: this.waypoints(),
      taskName: this.taskName(),
      flarmDeclaration: declaration,
      options: {
        defaultRadiusM: reg.radiiM.turnpointM,
        regulation: reg
      }
    };
  }
}
