import { Injectable } from '@angular/core';
import {
  CircuitLeg,
  CircuitLegRole,
  canWaypointBeArrival,
  canWaypointBeDeparture
} from '../models/circuit.model';
import {
  normalizeObservationZone,
  defaultObservationZoneForRole
} from '../models/observation-zone.model';
import {
  TaskDeclaration,
  TaskDeclarationPoint,
  TaskDeclarationPointRole,
  TaskExportOptions,
  DEFAULT_TASK_EXPORT_RADIUS_M
} from '../models/task-declaration.model';
import { Waypoint } from '../models/waypoint.model';
import { resolveLegElevationM } from '../utils/elevation.util';

@Injectable({
  providedIn: 'root'
})
export class TaskDeclarationResolver {
  resolve(
    legs: CircuitLeg[],
    waypointsById: Map<string, Waypoint>,
    taskName: string,
    options?: Partial<TaskExportOptions>
  ): TaskDeclaration {
    const warnings: string[] = [];
    const defaultRadiusM = options?.defaultRadiusM ?? DEFAULT_TASK_EXPORT_RADIUS_M;
    const declaredAtUtc = options?.declarationTimeUtc ?? new Date();
    const points: TaskDeclarationPoint[] = [];

    if (legs.length === 0) {
      return { taskName, declaredAtUtc, points, warnings };
    }

    const resolvedLegs = legs
      .map(leg => {
        const wp = waypointsById.get(leg.waypointId);
        if (!wp) {
          warnings.push(`Waypoint introuvable : ${leg.waypointId}`);
          return null;
        }
        return { leg, wp };
      })
      .filter((x): x is { leg: CircuitLeg; wp: Waypoint } => x !== null);

    let hasDepartureAirfield = false;
    let hasArrivalAirfield = false;

    for (const { leg, wp } of resolvedLegs) {
      if (leg.role === 'departure') {
        if (!canWaypointBeDeparture(wp)) {
          warnings.push(`« ${wp.name} » n’est pas un aérodrome : rôle décollage ignoré pour l’export.`);
          this.pushTurn(points, leg, wp, defaultRadiusM);
          continue;
        }
        hasDepartureAirfield = true;
        this.pushTakeoffAndStart(points, leg, wp, defaultRadiusM);
      } else if (leg.role === 'arrival') {
        if (!canWaypointBeArrival(wp)) {
          warnings.push(`« ${wp.name} » n’est pas un aérodrome : rôle atterrissage ignoré pour l’export.`);
          this.pushTurn(points, leg, wp, defaultRadiusM);
          continue;
        }
        hasArrivalAirfield = true;
        this.pushFinishAndLanding(points, leg, wp, defaultRadiusM);
      } else {
        this.pushTurn(points, leg, wp, defaultRadiusM);
      }

      const elev = resolveLegElevationM(wp, leg);
      if (elev == null) {
        warnings.push(`Altitude absente pour « ${wp.name} » (export TSK/CUP à 0 m si requis).`);
      }
    }

    if (!hasDepartureAirfield && resolvedLegs.length > 0) {
      warnings.push(
        'Pas d’aérodrome de décollage : TAKEOFF/LANDING IGC à zéro ; premier point utilisé comme START.'
      );
      this.ensureStartFromFirstTurn(points, resolvedLegs, defaultRadiusM);
    }

    if (!hasArrivalAirfield && resolvedLegs.length > 0) {
      warnings.push(
        'Pas d’aérodrome d’atterrissage : dernier point utilisé comme FINISH ; LANDING IGC à zéro si absent.'
      );
      this.ensureFinishFromLast(points, resolvedLegs, defaultRadiusM);
    }

    return {
      taskName: taskName.trim() || 'Task',
      declaredAtUtc,
      points: this.dedupeConsecutiveSameRole(points),
      warnings
    };
  }

  countTurnPoints(legs: CircuitLeg[]): number {
    return legs.filter(l => l.role === 'turnpoint').length;
  }

  private pushTakeoffAndStart(
    points: TaskDeclarationPoint[],
    leg: CircuitLeg,
    wp: Waypoint,
    defaultRadiusM: number
  ): void {
    const base = this.toPoint(leg, wp, defaultRadiusM);
    points.push({ ...base, role: 'takeoff' });
    points.push({ ...base, role: 'start' });
  }

  private pushFinishAndLanding(
    points: TaskDeclarationPoint[],
    leg: CircuitLeg,
    wp: Waypoint,
    defaultRadiusM: number
  ): void {
    const base = this.toPoint(leg, wp, defaultRadiusM);
    points.push({ ...base, role: 'finish' });
    points.push({ ...base, role: 'landing' });
  }

  private pushTurn(
    points: TaskDeclarationPoint[],
    leg: CircuitLeg,
    wp: Waypoint,
    defaultRadiusM: number
  ): void {
    points.push({ ...this.toPoint(leg, wp, defaultRadiusM), role: 'turn' });
  }

  private toPoint(
    leg: CircuitLeg,
    wp: Waypoint,
    defaultRadiusM: number
  ): Omit<TaskDeclarationPoint, 'role'> {
    const obsZone = normalizeObservationZone(
      leg.obsZone ?? defaultObservationZoneForRole(leg.role, defaultRadiusM),
      leg.role,
      defaultRadiusM
    );
    return {
      name: wp.name,
      cupName: wp.name,
      latitude: wp.latitude,
      longitude: wp.longitude,
      elevationM: resolveLegElevationM(wp, leg),
      radiusM: obsZone.r1M,
      obsZone,
      circuitRole: leg.role
    };
  }

  private ensureStartFromFirstTurn(
    points: TaskDeclarationPoint[],
    resolvedLegs: { leg: CircuitLeg; wp: Waypoint }[],
    defaultRadiusM: number
  ): void {
    if (points.some(p => p.role === 'start' || p.role === 'takeoff')) {
      return;
    }
    const first = resolvedLegs[0];
    if (!first) return;
    const base = this.toPoint(first.leg, first.wp, defaultRadiusM);
    points.unshift(
      { ...base, role: 'takeoff', latitude: 0, longitude: 0 },
      { ...base, role: 'start' }
    );
  }

  private ensureFinishFromLast(
    points: TaskDeclarationPoint[],
    resolvedLegs: { leg: CircuitLeg; wp: Waypoint }[],
    defaultRadiusM: number
  ): void {
    if (points.some(p => p.role === 'finish' || p.role === 'landing')) {
      return;
    }
    const last = resolvedLegs[resolvedLegs.length - 1];
    if (!last) return;
    const base = this.toPoint(last.leg, last.wp, defaultRadiusM);
    points.push({ ...base, role: 'finish' });
    points.push({ ...base, role: 'landing', latitude: 0, longitude: 0 });
  }

  private dedupeConsecutiveSameRole(
    points: TaskDeclarationPoint[]
  ): TaskDeclarationPoint[] {
    const out: TaskDeclarationPoint[] = [];
    for (const p of points) {
      const prev = out[out.length - 1];
      if (
        prev &&
        prev.role === p.role &&
        prev.cupName === p.cupName &&
        prev.latitude === p.latitude &&
        prev.longitude === p.longitude
      ) {
        continue;
      }
      out.push(p);
    }
    return out;
  }
}

/** Libellé IGC pour une ligne C-record point. */
export function igcKeywordForRole(role: TaskDeclarationPointRole): string {
  switch (role) {
    case 'takeoff':
      return 'TAKEOFF';
    case 'start':
      return 'START';
    case 'turn':
      return 'TURN';
    case 'finish':
      return 'FINISH';
    case 'landing':
      return 'LANDING';
  }
}

/** Préfixe SeeYou pour la ligne de tâche CUP. */
export function cupTaskPrefixForLegRole(role: CircuitLegRole): string {
  switch (role) {
    case 'departure':
    case 'arrival':
      return '0';
    default:
      return '1';
  }
}
