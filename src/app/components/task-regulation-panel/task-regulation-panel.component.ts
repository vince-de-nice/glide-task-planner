import { Component, computed, inject, input } from '@angular/core';
import { TranslateService } from '../../i18n/translate.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Checkbox } from 'primeng/checkbox';
import { Accordion, AccordionPanel, AccordionHeader, AccordionContent } from 'primeng/accordion';
import { Button } from 'primeng/button';
import { SelectButton } from 'primeng/selectbutton';
import { Tooltip } from 'primeng/tooltip';
import {
  TaskRegulationOverrides,
  TaskRuleProfileId,
  TaskStartKind
} from '../../models/task-rule-profile.model';
import { TaskRuleEngineService } from '../../services/task-rule-engine.service';
import { TaskStateService } from '../../services/task-state.service';
import { UiFeedbackService } from '../../services/ui-feedback.service';

@Component({
  selector: 'app-task-regulation-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Select,
    InputNumber,
    InputText,
    Checkbox,
    Accordion,
    AccordionPanel,
    AccordionHeader,
    AccordionContent,
    Button,
    SelectButton,
    Tooltip,
    TranslatePipe
  ],
  templateUrl: './task-regulation-panel.component.html',
  styleUrl: './task-regulation-panel.component.scss'
})
export class TaskRegulationPanelComponent {
  private taskState = inject(TaskStateService);
  private ruleEngine = inject(TaskRuleEngineService);
  private uiFeedback = inject(UiFeedbackService);
  private i18n = inject(TranslateService);

  disabled = input(false);
  compact = input(false);
  /** Panneau plein onglet : paramètres visibles sans accordéon. */
  embeddedInTab = input(false);

  readonly profileOptions = computed(() => {
    this.i18n.locale();
    return this.ruleEngine.getProfileOptions().map(p => ({
      label: this.i18n.t(`regulation.profiles.${p.id}.label`),
      value: p.id,
      description: this.i18n.t(`regulation.profiles.${p.id}.description`)
    }));
  });

  readonly resolved = this.taskState.resolvedRegulation;
  readonly isCustom = computed(() => this.taskState.regulation().profileId === 'custom');

  readonly startKindOptions = computed(() => {
    this.i18n.locale();
    return [
      { label: this.i18n.t('regulation.startKind.line'), value: 'line' as TaskStartKind },
      { label: this.i18n.t('regulation.startKind.cylinder'), value: 'cylinder' as TaskStartKind }
    ];
  });

  profileDescription(): string {
    return this.i18n.t(`regulation.profiles.${this.profileId()}.description`);
  }

  scoringInfoTooltip(): string {
    return this.i18n.t('regulation.scoringTooltip');
  }

  profileId = computed(() => this.taskState.regulation().profileId);

  onProfileChange(nextId: TaskRuleProfileId | null): void {
    if (!nextId || nextId === this.profileId()) return;
    const _previous = this.profileId();
    void this.uiFeedback
      .confirm({
        header: this.i18n.t('regulation.changeProfileHeader'),
        message: this.i18n.t('regulation.changeProfileMessage'),
        acceptLabel: this.i18n.t('regulation.applyProfileYes'),
        rejectLabel: this.i18n.t('regulation.applyProfileNo')
      })
      .then(applyZones => {
        this.taskState.setRegulationProfile(nextId);
        if (applyZones) {
          this.taskState.applyRegulationToAllLegs();
          this.uiFeedback.success(
            this.i18n.t('regulation.applied'),
            this.i18n.t('regulation.appliedDetail')
          );
        }
      })
  }

  applyRegulation(): void {
    this.taskState.applyRegulationToAllLegs();
    this.uiFeedback.success(
      this.i18n.t('regulation.zonesUpdated'),
      this.i18n.t('regulation.zonesUpdatedDetail')
    );
  }

  patchOverrides(patch: TaskRegulationOverrides): void {
    const current = this.taskState.regulation();
    this.taskState.setRegulation({
      profileId: current.profileId,
      overrides: this.ruleEngine.mergeOverrides(current.overrides, patch)
    });
  }

  radiiDeparture(): number {
    return this.resolved().radiiM.departureM;
  }
  radiiTurn(): number {
    return this.resolved().radiiM.turnpointM;
  }
  radiiArrival(): number {
    return this.resolved().radiiM.arrivalM;
  }

  onRadiiDeparture(v: number): void {
    this.patchOverrides({ radiiM: { departureM: v } });
  }
  onRadiiTurn(v: number): void {
    this.patchOverrides({ radiiM: { turnpointM: v } });
  }
  onRadiiArrival(v: number): void {
    this.patchOverrides({ radiiM: { arrivalM: v } });
  }

  pevEnabled(): boolean {
    return this.resolved().startFai.pevEnabled;
  }
  onPevEnabled(v: boolean): void {
    this.patchOverrides({ startFai: { pevEnabled: v } });
  }

  pevWait(): number {
    return this.resolved().startFai.pevWaitMin;
  }
  onPevWait(v: number): void {
    this.patchOverrides({ startFai: { pevWaitMin: v } });
  }

  pevWindow(): number {
    return this.resolved().startFai.pevWindowMin;
  }
  onPevWindow(v: number): void {
    this.patchOverrides({ startFai: { pevWindowMin: v } });
  }

  startKind(): TaskStartKind {
    return this.resolved().startFai.startKind;
  }
  onStartKind(v: TaskStartKind): void {
    this.patchOverrides({ startFai: { startKind: v } });
  }

  noStart(): string {
    return this.resolved().cupOptions.noStart ?? '';
  }
  onNoStart(v: string): void {
    this.patchOverrides({ cupOptions: { noStart: v.trim() || null } });
  }

  canEditAdvanced(): boolean {
    const id = this.profileId();
    return id === 'custom' || id === 'fai_line_pev' || id === 'fai_cylinder_start';
  }

  regulationSummary(): string {
    this.i18n.locale();
    const r = this.resolved();
    const d = r.radiiM.departureM;
    const t = r.radiiM.turnpointM;
    const a = r.radiiM.arrivalM;
    const label = this.i18n.t(`regulation.profiles.${this.profileId()}.label`);
    let line = `${label} · D${d} / V${t} / A${a}`;
    if (r.startFai.pevEnabled) {
      line += ` · PEV ${r.startFai.pevWaitMin}+${r.startFai.pevWindowMin} min`;
    }
    return line;
  }
}
