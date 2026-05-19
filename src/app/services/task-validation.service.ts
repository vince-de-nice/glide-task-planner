import { Injectable, inject } from '@angular/core';
import { CircuitLeg } from '../models/circuit.model';
import { TaskDeclaration, ResolvedTaskRegulation } from '../models/task-declaration.model';
import { Waypoint } from '../models/waypoint.model';
import { isValidLatitude, isValidLongitude } from '../utils/geo-format.util';
import { TaskRuleEngineService } from './task-rule-engine.service';
import { TranslateService } from '../i18n/translate.service';

export interface TaskValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable({
  providedIn: 'root'
})
export class TaskValidationService {
  private ruleEngine = inject(TaskRuleEngineService);
  private i18n = inject(TranslateService);

  validateForExport(
    legs: CircuitLeg[],
    declaration: TaskDeclaration,
    waypointsById: Map<string, Waypoint>,
    regulation: ResolvedTaskRegulation,
    cupWaypointNames?: Set<string>
  ): TaskValidationResult {
    const errors: string[] = [];
    const warnings = [...declaration.warnings];

    if (legs.length === 0) {
      errors.push(this.i18n.t('rules.emptyCircuit'));
    }

    if (legs.length === 1) {
      warnings.push(this.i18n.t('validation.singlePoint'));
    }

    const hasCoursePoint = declaration.points.some(
      p => p.role === 'start' || p.role === 'turn' || p.role === 'finish'
    );
    if (legs.length > 0 && !hasCoursePoint) {
      errors.push(this.i18n.t('validation.noCoursePoint'));
    }

    for (const p of declaration.points) {
      if (!isValidLatitude(p.latitude) || !isValidLongitude(p.longitude)) {
        if (p.role === 'takeoff' || p.role === 'landing') {
          if (p.latitude === 0 && p.longitude === 0) {
            continue;
          }
        }
        errors.push(this.i18n.t('validation.invalidCoords', { name: p.name }));
      }
    }

    if (cupWaypointNames) {
      const checked = new Set<string>();
      for (const p of declaration.points) {
        if (checked.has(p.cupName)) {
          continue;
        }
        checked.add(p.cupName);
        if (!cupWaypointNames.has(p.cupName)) {
          warnings.push(this.i18n.t('validation.missingFromCup', { name: p.cupName }));
        }
      }
    }

    const ruleResult = this.ruleEngine.validate(legs, waypointsById, regulation);
    errors.push(...ruleResult.errors);
    warnings.push(...ruleResult.warnings);

    const hasErrors = errors.length > 0;

    return {
      valid: !hasErrors || regulation.allowExportDespiteErrors,
      errors: [...new Set(errors)],
      warnings: [...new Set(warnings)]
    };
  }

  buildCupNameSet(waypoints: Waypoint[]): Set<string> {
    return new Set(waypoints.map(w => w.name));
  }
}
