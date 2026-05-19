import { Injectable } from '@angular/core';
import { CircuitLeg } from '../models/circuit.model';
import { TaskDeclaration } from '../models/task-declaration.model';
import { cupTaskPrefixForLegRole } from './task-declaration.resolver';
import { formatCupObsZoneLine, normalizeObservationZone, defaultObservationZoneForRole } from '../models/observation-zone.model';
import { DEFAULT_TASK_EXPORT_RADIUS_M } from '../models/task-declaration.model';

const TASKS_SEPARATOR = '-----Related Tasks-----';

@Injectable({
  providedIn: 'root'
})
export class CupTaskWriterService {
  appendTaskSection(
    cupWaypointsBody: string,
    legs: CircuitLeg[],
    waypointNamesById: Map<string, string>,
    declaration: TaskDeclaration,
    defaultRadiusM = DEFAULT_TASK_EXPORT_RADIUS_M
  ): string {
    const base = cupWaypointsBody.trimEnd();
    const taskLine = this.buildTaskLine(legs, waypointNamesById, declaration.taskName);
    const obsZones = this.buildObsZoneLines(legs, defaultRadiusM);
    const parts = [base, '', TASKS_SEPARATOR, taskLine, ...obsZones];
    return parts.join('\n') + '\n';
  }

  private buildTaskLine(
    legs: CircuitLeg[],
    waypointNamesById: Map<string, string>,
    taskName: string
  ): string {
    const desc = this.csvQuote(taskName || 'VAV Task');
    const refs = legs.map(leg => {
      const cupName = waypointNamesById.get(leg.waypointId) ?? '';
      const prefix = cupTaskPrefixForLegRole(leg.role);
      return `"${prefix}${cupName}"`;
    });
    return [desc, ...refs].join(',');
  }

  private buildObsZoneLines(legs: CircuitLeg[], defaultRadiusM: number): string[] {
    return legs.map((leg, index) => {
      const zone = normalizeObservationZone(
        leg.obsZone ?? defaultObservationZoneForRole(leg.role, defaultRadiusM),
        leg.role,
        defaultRadiusM
      );
      return formatCupObsZoneLine(index, zone);
    });
  }

  private csvQuote(value: string): string {
    const v = value.replace(/"/g, '""');
    return `"${v}"`;
  }
}
