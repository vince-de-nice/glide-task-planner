import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  viewChild
} from '@angular/core';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { TaskStateService } from '../../../services/task-state.service';
import { WaypointService } from '../../../services/waypoint.service';
import { TaskRuleEngineService } from '../../../services/task-rule-engine.service';
import {
  DistanceResult,
  TaskLegDistance
} from '../../../services/distance.service';
import { CircuitLeg, CircuitLegRole } from '../../../models/circuit.model';
import { CircuitListItem } from '../../../models/circuit-list-item.model';
import { observationZoneShortLabelI18n } from '../../../i18n/zone-label.util';
import { TranslateService } from '../../../i18n/translate.service';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { formatElevationDisplay, resolveLegElevationM } from '../../../utils/elevation.util';
import { WaypointType } from '../../../models/waypoint.model';
import { waypointTypeDisplayI18n } from '../../../i18n/display-i18n.util';
import { buildCircuitListItems } from '../../../utils/circuit-list.util';
import { ObsZonePreviewComponent } from '../../obs-zone-preview/obs-zone-preview.component';

@Component({
  selector: 'app-circuit-points-panel',
  standalone: true,
  imports: [CommonModule, DragDropModule, Button, Tooltip, ObsZonePreviewComponent, TranslatePipe],
  templateUrl: './circuit-points-panel.component.html',
  styleUrl: './circuit-points-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CircuitPointsPanelComponent {
  private taskState = inject(TaskStateService);
  private waypointService = inject(WaypointService);
  private ruleEngine = inject(TaskRuleEngineService);
  private i18n = inject(TranslateService);
  distanceResult = input<DistanceResult | null>(null);
  focusedWaypointId = input<string | null>(null);
  focusedLegIndex = input<number | null>(null);

  private listEl = viewChild<ElementRef<HTMLElement>>('circuitList');

  waypoints = this.waypointService.waypoints;

  constructor() {
    effect(() => {
      const wpId = this.focusedWaypointId();
      const legIndex = this.focusedLegIndex();
      if (!wpId) return;
      queueMicrotask(() => {
        const root = this.listEl()?.nativeElement;
        if (!root) return;
        const selector =
          legIndex != null
            ? `[data-leg-index="${legIndex}"]`
            : `[data-waypoint-id="${wpId}"]`;
        const row = root.querySelector<HTMLElement>(selector);
        row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    });
  }

  isRowFocused(item: CircuitListItem): boolean {
    const wpId = this.focusedWaypointId();
    if (!wpId || item.waypoint.id !== wpId) return false;
    const legIndex = this.focusedLegIndex();
    return legIndex == null || legIndex === item.legIndex;
  }

  circuitDrop = output<CircuitLeg[]>();
  circuitItemClick = output<CircuitListItem>();
  openLegZone = output<{ legIndex: number; event?: Event }>();
  removeItem = output<number>();
  addPoints = output<void>();

  circuitLegs = this.taskState.circuitLegs;
  resolvedRegulation = this.taskState.resolvedRegulation;

  waypointTypeDisplay(type: WaypointType) {
    return waypointTypeDisplayI18n(type, this.i18n);
  }

  circuitRoleLabel(role: CircuitLegRole): string {
    return this.i18n.t(`circuit.role.${role}`);
  }

  ruleValidation = computed(() => {
    const wpMap = new Map(this.waypoints().map(w => [w.id, w]));
    return this.ruleEngine.validate(
      this.circuitLegs(),
      wpMap,
      this.resolvedRegulation()
    );
  });

  circuitListItems = computed(() =>
    buildCircuitListItems(
      this.circuitLegs(),
      id => this.waypointService.getWaypoint(id),
      this.taskState.defaultZoneRadiusM()
    )
  );

  onCircuitDrop(event: CdkDragDrop<CircuitListItem[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    const items = [...this.circuitListItems()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.circuitDrop.emit(items.map(i => i.leg));
  }

  legZoneLabel(item: CircuitListItem): string {
    const zone = item.leg.obsZone;
    return zone ? observationZoneShortLabelI18n(zone, this.i18n) : '—';
  }

  legElevationLabel(item: CircuitListItem): string {
    return formatElevationDisplay(resolveLegElevationM(item.waypoint, item.leg));
  }

  legZoneShort(item: CircuitListItem): string {
    return `${this.legZoneLabel(item)} · ${this.legElevationLabel(item)}`;
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
    return this.legIssueMessage(index) ?? this.i18n.t('common.compliant');
  }

  legFromIndex(index: number): TaskLegDistance | undefined {
    return this.distanceResult()?.legDistances.find(leg => leg.fromIndex === index);
  }
}
