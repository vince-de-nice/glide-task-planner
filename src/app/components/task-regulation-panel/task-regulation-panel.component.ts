import { Component, computed, inject, input, output, signal } from '@angular/core';
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
  TaskRegulationState,
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
    Tooltip
  ],
  templateUrl: './task-regulation-panel.component.html',
  styleUrl: './task-regulation-panel.component.scss'
})
export class TaskRegulationPanelComponent {
  private taskState = inject(TaskStateService);
  private ruleEngine = inject(TaskRuleEngineService);
  private uiFeedback = inject(UiFeedbackService);

  disabled = input(false);
  compact = input(false);
  /** Panneau plein onglet : paramètres visibles sans accordéon. */
  embeddedInTab = input(false);

  readonly scoringInfoTooltip =
    'L’app prépare les fichiers de déclaration. Le scoring officiel (trace IGC, PEV sur enregistreur principal) reste du ressort du scorer. FLARM : waypoints sans zones.';

  readonly profileOptions = this.ruleEngine.getProfileOptions().map(p => ({
    label: p.label,
    value: p.id,
    description: p.description
  }));

  readonly resolved = this.taskState.resolvedRegulation;
  readonly isCustom = computed(() => this.taskState.regulation().profileId === 'custom');

  readonly startKindOptions = [
    { label: 'Ligne', value: 'line' as TaskStartKind },
    { label: 'Cylindre', value: 'cylinder' as TaskStartKind }
  ];

  profileId = computed(() => this.taskState.regulation().profileId);

  onProfileChange(nextId: TaskRuleProfileId | null): void {
    if (!nextId || nextId === this.profileId()) return;
    const previous = this.profileId();
    void this.uiFeedback
      .confirm({
        header: 'Changer de règlement',
        message:
          'Appliquer les valeurs par défaut du profil (rayons et zones) à tous les points du circuit ?',
        acceptLabel: 'Oui, appliquer',
        rejectLabel: 'Non, garder les zones'
      })
      .then(applyZones => {
        this.taskState.setRegulationProfile(nextId);
        if (applyZones) {
          this.taskState.applyRegulationToAllLegs();
          this.uiFeedback.success('Règlement appliqué', 'Profil et zones mis à jour.');
        }
      })
  }

  applyRegulation(): void {
    this.taskState.applyRegulationToAllLegs();
    this.uiFeedback.success('Zones mises à jour', 'Rayons et préréglages du règlement appliqués.');
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
    const r = this.resolved();
    const d = r.radiiM.departureM;
    const t = r.radiiM.turnpointM;
    const a = r.radiiM.arrivalM;
    let line = `${r.label} · D${d} / V${t} / A${a}`;
    if (r.startFai.pevEnabled) {
      line += ` · PEV ${r.startFai.pevWaitMin}+${r.startFai.pevWindowMin} min`;
    }
    return line;
  }
}
