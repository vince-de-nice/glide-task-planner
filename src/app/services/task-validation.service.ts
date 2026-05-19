import { Injectable } from '@angular/core';
import { CircuitLeg } from '../models/circuit.model';
import { TaskDeclaration } from '../models/task-declaration.model';
import { Waypoint } from '../models/waypoint.model';
import { isValidLatitude, isValidLongitude } from '../utils/geo-format.util';

export interface TaskValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable({
  providedIn: 'root'
})
export class TaskValidationService {
  validateForExport(
    legs: CircuitLeg[],
    declaration: TaskDeclaration,
    cupWaypointNames?: Set<string>
  ): TaskValidationResult {
    const errors: string[] = [];
    const warnings = [...declaration.warnings];

    if (legs.length === 0) {
      errors.push('Le circuit est vide.');
    }

    if (legs.length === 1) {
      warnings.push('Un seul point : la déclaration peut être incomplète pour certains formats.');
    }

    const hasCoursePoint = declaration.points.some(
      p => p.role === 'start' || p.role === 'turn' || p.role === 'finish'
    );
    if (legs.length > 0 && !hasCoursePoint) {
      errors.push('Aucun point de course (START, TURN ou FINISH) dans la déclaration.');
    }

    for (const p of declaration.points) {
      if (!isValidLatitude(p.latitude) || !isValidLongitude(p.longitude)) {
        if (p.role === 'takeoff' || p.role === 'landing') {
          if (p.latitude === 0 && p.longitude === 0) {
            continue;
          }
        }
        errors.push(`Coordonnées invalides pour « ${p.name} ».`);
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
          warnings.push(
            `« ${p.cupName} » absent de la base CUP chargée : export CUP/CUPX peut échouer dans SeeYou.`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  buildCupNameSet(waypoints: Waypoint[]): Set<string> {
    return new Set(waypoints.map(w => w.name));
  }
}
