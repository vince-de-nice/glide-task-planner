import { Injectable } from '@angular/core';
import { CircuitLeg, CircuitLegRole } from '../models/circuit.model';
import {
  normalizeObservationZone,
  defaultObservationZoneForRole
} from '../models/observation-zone.model';
import { TaskDeclaration, TaskDeclarationPoint } from '../models/task-declaration.model';
import { Waypoint } from '../models/waypoint.model';
import { resolveLegElevationM, formatTskAltitude } from '../utils/elevation.util';
import {
  formatTskObservationZoneTag,
  mapObservationZoneToTsk
} from '../utils/obs-zone-tsk.util';
import { DEFAULT_TASK_EXPORT_RADIUS_M } from '../models/task-declaration.model';

@Injectable({
  providedIn: 'root'
})
export class TskWriterService {
  /** Export aligné sur les jambes du circuit (une zone par point de tâche). */
  generateFromLegs(
    legs: CircuitLeg[],
    waypointsById: Map<string, Waypoint>,
    taskName: string,
    defaultRadiusM = DEFAULT_TASK_EXPORT_RADIUS_M
  ): string {
    const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
    lines.push('<Task type="RT">');

    for (const leg of legs) {
      const wp = waypointsById.get(leg.waypointId);
      if (!wp) continue;
      const pointType = this.tskPointTypeFromLegRole(leg.role);
      if (!pointType) continue;

      const obsZone = normalizeObservationZone(
        leg.obsZone ?? defaultObservationZoneForRole(leg.role, defaultRadiusM),
        leg.role,
        defaultRadiusM
      );
      const elev = formatTskAltitude(resolveLegElevationM(wp, leg));
      const lat = this.formatCoord(wp.latitude);
      const lon = this.formatCoord(wp.longitude);
      const name = this.escapeXml(wp.name);
      const tskZone = mapObservationZoneToTsk(obsZone, leg.role);

      lines.push(`\t<Point type="${pointType}">`);
      lines.push(`\t\t<Waypoint name="${name}" comment="" id="0" altitude="${elev}">`);
      lines.push(`\t\t\t<Location latitude="${lat}" longitude="${lon}"/>`);
      lines.push('\t\t</Waypoint>');
      lines.push(formatTskObservationZoneTag(tskZone));
      lines.push('\t</Point>');
    }

    lines.push('</Task>');
    return lines.join('\n') + '\n';
  }

  /** @deprecated Préférer generateFromLegs pour respecter les zones par point. */
  generate(declaration: TaskDeclaration): string {
    const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
    lines.push('<Task type="RT">');

    const ordered = this.orderPointsForTsk(declaration.points);
    for (const p of ordered) {
      lines.push(...this.pointBlock(p));
    }

    lines.push('</Task>');
    return lines.join('\n') + '\n';
  }

  private tskPointTypeFromLegRole(
    role: CircuitLegRole
  ): 'Start' | 'Turn' | 'Finish' | null {
    switch (role) {
      case 'departure':
        return 'Start';
      case 'turnpoint':
        return 'Turn';
      case 'arrival':
        return 'Finish';
      default:
        return null;
    }
  }

  private orderPointsForTsk(points: TaskDeclarationPoint[]): TaskDeclarationPoint[] {
    const roleOrder: TaskDeclarationPoint['role'][] = [
      'takeoff',
      'start',
      'turn',
      'finish',
      'landing'
    ];
    const out: TaskDeclarationPoint[] = [];
    const used = new Set<TaskDeclarationPoint>();

    for (const role of roleOrder) {
      for (const p of points) {
        if (p.role !== role || used.has(p)) {
          continue;
        }
        if (role === 'takeoff') {
          continue;
        }
        if (role === 'landing') {
          const hasFinish = points.some(
            x => x.role === 'finish' && x.cupName === p.cupName
          );
          if (hasFinish) {
            used.add(p);
            continue;
          }
        }
        out.push(p);
        used.add(p);
      }
    }
    for (const p of points) {
      if (!used.has(p)) {
        out.push(p);
      }
    }
    return out;
  }

  private pointBlock(p: TaskDeclarationPoint): string[] {
    const type = this.tskPointType(p.role);
    if (!type) {
      return [];
    }
    const legRole = p.circuitRole ?? (type === 'Start' ? 'departure' : type === 'Finish' ? 'arrival' : 'turnpoint');
    const obsZone = normalizeObservationZone(
      p.obsZone ?? defaultObservationZoneForRole(legRole, p.radiusM ?? 400),
      legRole,
      p.radiusM ?? 400
    );
    const lat = this.formatCoord(p.latitude);
    const lon = this.formatCoord(p.longitude);
    const name = this.escapeXml(p.name);
    const elev = formatTskAltitude(p.elevationM);
    const tskZone = mapObservationZoneToTsk(obsZone, legRole);

    return [
      `\t<Point type="${type}">`,
      `\t\t<Waypoint name="${name}" comment="" id="0" altitude="${elev}">`,
      `\t\t\t<Location latitude="${lat}" longitude="${lon}"/>`,
      '\t\t</Waypoint>',
      formatTskObservationZoneTag(tskZone),
      '\t</Point>'
    ];
  }

  private tskPointType(
    role: TaskDeclarationPoint['role']
  ): 'Start' | 'Turn' | 'Finish' | null {
    switch (role) {
      case 'start':
      case 'takeoff':
        return 'Start';
      case 'turn':
        return 'Turn';
      case 'finish':
      case 'landing':
        return 'Finish';
      default:
        return null;
    }
  }

  private formatCoord(value: number): string {
    return Number(value.toFixed(6)).toString();
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
