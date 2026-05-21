import { Injectable, inject } from '@angular/core';
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
import {
  DEFAULT_TASK_EXPORT_RADIUS_M,
  ResolvedTaskRegulation
} from '../models/task-declaration.model';
import { TaskRuleEngineService } from './task-rule-engine.service';
import {
  bearingDegrees,
  cupFixedAxisBearingDeg,
  ObsZoneLegContext
} from '../utils/obs-zone-map.util';

@Injectable({
  providedIn: 'root'
})
export class TskWriterService {
  private ruleEngine = inject(TaskRuleEngineService);

  /** Export aligné sur les jambes du circuit (une zone par point de tâche). */
  generateFromLegs(
    legs: CircuitLeg[],
    waypointsById: Map<string, Waypoint>,
    taskName: string,
    defaultRadiusM = DEFAULT_TASK_EXPORT_RADIUS_M,
    regulation?: ResolvedTaskRegulation
  ): string {
    const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
    lines.push(this.buildTaskOpenTag(regulation));

    // Point de départ pour Style 4 (vers départ)
    const depLeg = legs.find(l => l.role === 'departure');
    const departureWp = depLeg ? (waypointsById.get(depLeg.waypointId) ?? null) : null;

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const wp = waypointsById.get(leg.waypointId);
      if (!wp) continue;
      const pointType = this.tskPointTypeFromLegRole(leg.role);
      if (!pointType) continue;

      const r =
        regulation != null
          ? this.ruleEngine.radiusForLegRole(regulation, leg.role)
          : defaultRadiusM;
      const obsZone = normalizeObservationZone(
        leg.obsZone ?? defaultObservationZoneForRole(leg.role, r),
        leg.role,
        r
      );

      // Cap de référence pour orienter les secteurs dans le TSK (radiales absolues).
      const prevWp = i > 0 ? (waypointsById.get(legs[i - 1].waypointId) ?? null) : null;
      const nextWp = i < legs.length - 1 ? (waypointsById.get(legs[i + 1].waypointId) ?? null) : null;
      const ctx: ObsZoneLegContext = {
        legIndex: i,
        leg,
        waypoint: wp,
        prev: prevWp,
        next: nextWp,
        departure: departureWp,
        defaultRadiusM: r
      };
      const referenceBearingDeg = this.computeReferenceBearing(obsZone.cupStyle, obsZone.a12Deg, ctx);

      const elev = formatTskAltitude(resolveLegElevationM(wp, leg));
      const lat = this.formatCoord(wp.latitude);
      const lon = this.formatCoord(wp.longitude);
      const name = this.escapeXml(wp.name);
      const tskZone = mapObservationZoneToTsk(obsZone, leg.role, referenceBearingDeg);

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

  /**
   * Calcule le cap de référence absolu (°) pour orienter une zone CUP dans le TSK.
   * Équivalent simplifié de cupZoneReferenceBearingDeg (sans les lignes qui n'en ont pas besoin).
   */
  private computeReferenceBearing(
    cupStyle: number,
    a12Deg: number | undefined,
    ctx: ObsZoneLegContext
  ): number {
    const { waypoint: wp, prev, next, departure } = ctx;
    switch (cupStyle) {
      case 0:
        return cupFixedAxisBearingDeg(a12Deg);
      case 1:
        if (prev && next) {
          const fromPrev = bearingDegrees(prev.latitude, prev.longitude, wp.latitude, wp.longitude);
          const toNext = bearingDegrees(wp.latitude, wp.longitude, next.latitude, next.longitude);
          let diff = toNext - fromPrev;
          if (diff > 180) diff -= 360;
          if (diff < -180) diff += 360;
          return (fromPrev + diff / 2 + 360) % 360;
        }
        return cupFixedAxisBearingDeg(a12Deg);
      case 2:
        return next
          ? bearingDegrees(wp.latitude, wp.longitude, next.latitude, next.longitude)
          : 0;
      case 3:
        return prev
          ? bearingDegrees(prev.latitude, prev.longitude, wp.latitude, wp.longitude)
          : 0;
      case 4:
        return departure
          ? bearingDegrees(wp.latitude, wp.longitude, departure.latitude, departure.longitude)
          : 0;
      default:
        return cupFixedAxisBearingDeg(a12Deg);
    }
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
    // Méthode dépréciée : pas de contexte waypoint → bearing inconnu (0° = Nord).
    const tskZone = mapObservationZoneToTsk(obsZone, legRole, undefined);

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

  private buildTaskOpenTag(regulation?: ResolvedTaskRegulation): string {
    if (!regulation) {
      return '<Task type="RT">';
    }
    const attrs: string[] = ['type="RT"'];
    const fai = regulation.startFai;

    // Heure d'ouverture du start (HH:MM:SS → XCSoar start_open_time).
    if (regulation.cupOptions.noStart) {
      attrs.push(`start_open_time="${this.escapeXml(regulation.cupOptions.noStart)}"`);
    }

    // PEV : attributs spécifiques XCSoar pour le départ PEV.
    if (fai.pevEnabled) {
      attrs.push(`pev_start_wait_minutes="${fai.pevWaitMin}"`);
      attrs.push(`pev_start_window_minutes="${fai.pevWindowMin}"`);
    }

    // Vitesse sol max au départ : km/h → m/s (XCSoar start_max_speed en m/s).
    if (fai.maxStartGroundSpeedKmh != null) {
      const speedMs = Math.round((fai.maxStartGroundSpeedKmh / 3.6) * 10) / 10;
      attrs.push(`start_max_speed="${speedMs}"`);
    }

    return `<Task ${attrs.join(' ')}>`;
  }
}
