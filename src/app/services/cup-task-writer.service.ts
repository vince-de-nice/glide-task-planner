import { Injectable, inject } from '@angular/core';
import { CircuitLeg } from '../models/circuit.model';
import { TaskDeclaration } from '../models/task-declaration.model';
import { cupTaskPrefixForLegRole } from './task-declaration.resolver';
import { formatCupObsZoneLine, normalizeObservationZone, defaultObservationZoneForRole } from '../models/observation-zone.model';
import { DEFAULT_TASK_EXPORT_RADIUS_M, ResolvedTaskRegulation } from '../models/task-declaration.model';
import { TaskRuleEngineService } from './task-rule-engine.service';

const TASKS_SEPARATOR = '-----Related Tasks-----';

@Injectable({
  providedIn: 'root'
})
export class CupTaskWriterService {
  private ruleEngine = inject(TaskRuleEngineService);

  appendTaskSection(
    cupWaypointsBody: string,
    legs: CircuitLeg[],
    waypointNamesById: Map<string, string>,
    declaration: TaskDeclaration,
    defaultRadiusM = DEFAULT_TASK_EXPORT_RADIUS_M,
    regulation?: ResolvedTaskRegulation
  ): string {
    const base = cupWaypointsBody.trimEnd();
    const taskLine = this.buildTaskLine(legs, waypointNamesById, declaration.taskName);
    const reg = regulation;
    const optionsLine =
      reg != null ? this.ruleEngine.buildCupOptionsLine(legs, reg) : null;
    const obsZones = this.buildObsZoneLines(legs, defaultRadiusM, reg);
    const parts = [base, '', TASKS_SEPARATOR, taskLine];
    if (optionsLine) {
      parts.push(optionsLine);
    }
    parts.push(...obsZones);
    return parts.join('\n') + '\n';
  }

  private buildTaskLine(
    legs: CircuitLeg[],
    waypointNamesById: Map<string, string>,
    taskName: string
  ): string {
    const desc = this.csvQuote(taskName || 'Tâche');
    const refs = legs.map(leg => {
      const cupName = waypointNamesById.get(leg.waypointId) ?? '';
      const prefix = cupTaskPrefixForLegRole(leg.role);
      return `"${prefix}${cupName}"`;
    });
    return [desc, ...refs].join(',');
  }

  private buildObsZoneLines(
    legs: CircuitLeg[],
    defaultRadiusM: number,
    regulation?: ResolvedTaskRegulation
  ): string[] {
    return legs.map((leg, index) => {
      const r =
        regulation != null
          ? this.ruleEngine.radiusForLegRole(regulation, leg.role)
          : defaultRadiusM;
      const zone = normalizeObservationZone(
        leg.obsZone ?? defaultObservationZoneForRole(leg.role, r),
        leg.role,
        r
      );
      return formatCupObsZoneLine(index, zone);
    });
  }

  private csvQuote(value: string): string {
    const v = value.replace(/"/g, '""');
    return `"${v}"`;
  }
}
