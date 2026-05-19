import { Injectable } from '@angular/core';
import {
  canWaypointBeArrival,
  canWaypointBeDeparture,
  CircuitLeg,
  CircuitLegRole
} from '../models/circuit.model';
import {
  observationZoneFromPreset,
  normalizeObservationZone,
  ObsZonePresetId
} from '../models/observation-zone.model';
import {
  CupTaskOptionsConfig,
  DEFAULT_TASK_REGULATION,
  FAI_CYLINDER_START_MIN_RADIUS_M,
  FAI_PEV_MAX_MINUTES,
  FAI_PEV_MIN_MINUTES,
  radiusForRole,
  ResolvedTaskRegulation,
  TaskRegulationOverrides,
  TaskRegulationState,
  TASK_RULE_PROFILES,
  TaskRuleProfileId
} from '../models/task-rule-profile.model';
import { Waypoint } from '../models/waypoint.model';

export interface TaskRuleLegIssue {
  legIndex: number;
  severity: 'error' | 'warning';
  message: string;
}

export interface TaskRuleValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  legIssues: TaskRuleLegIssue[];
}

@Injectable({
  providedIn: 'root'
})
export class TaskRuleEngineService {
  resolveRegulation(state: TaskRegulationState = DEFAULT_TASK_REGULATION): ResolvedTaskRegulation {
    const def = TASK_RULE_PROFILES[state.profileId] ?? TASK_RULE_PROFILES.club;
    const o = state.overrides;

    const radiiM = {
      departureM: o.radiiM?.departureM ?? def.radiiM.departureM,
      turnpointM: o.radiiM?.turnpointM ?? def.radiiM.turnpointM,
      arrivalM: o.radiiM?.arrivalM ?? def.radiiM.arrivalM
    };

    const cupOptions: CupTaskOptionsConfig = {
      ...def.cupOptions,
      ...o.cupOptions
    };

    const startFai = {
      ...def.startFai,
      ...o.startFai
    };

    const constraints =
      state.profileId === 'custom' && o.constraints != null
        ? o.constraints
        : def.constraints;

    return {
      profileId: def.id,
      label: def.label,
      description: def.description,
      radiiM,
      obsZonePresetByRole: { ...def.obsZonePresetByRole },
      cupOptions,
      startFai,
      constraints,
      allowExportDespiteErrors: def.allowExportDespiteErrors ?? false
    };
  }

  getProfileOptions(): { id: TaskRuleProfileId; label: string; description: string }[] {
    return Object.values(TASK_RULE_PROFILES).map(p => ({
      id: p.id,
      label: p.label,
      description: p.description
    }));
  }

  radiusForLegRole(regulation: ResolvedTaskRegulation, role: CircuitLegRole): number {
    return radiusForRole(regulation.radiiM, role);
  }

  applyProfileToLegs(legs: CircuitLeg[], regulation: ResolvedTaskRegulation): CircuitLeg[] {
    return legs.map(leg => {
      const presetId = regulation.obsZonePresetByRole[leg.role];
      const r = this.radiusForLegRole(regulation, leg.role);
      const obsZone = observationZoneFromPreset(presetId, r);
      return {
        ...leg,
        obsZone: normalizeObservationZone(obsZone, leg.role, r)
      };
    });
  }

  validate(
    legs: CircuitLeg[],
    waypointsById: Map<string, Waypoint>,
    regulation: ResolvedTaskRegulation
  ): TaskRuleValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const legIssues: TaskRuleLegIssue[] = [];

    if (legs.length === 0) {
      return { valid: false, errors: ['Le circuit est vide.'], warnings, legIssues };
    }

    const hasDeparture = legs.some(l => l.role === 'departure');
    const hasArrival = legs.some(l => l.role === 'arrival');
    const turnCount = legs.filter(l => l.role === 'turnpoint').length;

    for (const c of regulation.constraints) {
      switch (c) {
        case 'require_airfield_departure':
          if (!hasDeparture) {
            errors.push('Un aérodrome de décollage est requis pour ce règlement.');
          }
          break;
        case 'require_airfield_arrival':
          if (!hasArrival) {
            errors.push('Un aérodrome d’atterrissage est requis pour ce règlement.');
          }
          break;
        case 'min_turnpoints':
          if (turnCount < 1) {
            errors.push('Au moins un point de virage est requis.');
          }
          break;
        case 'pev_wait_window_range':
          if (regulation.startFai.pevEnabled) {
            const w = regulation.startFai.pevWaitMin;
            const win = regulation.startFai.pevWindowMin;
            if (w < FAI_PEV_MIN_MINUTES || w > FAI_PEV_MAX_MINUTES) {
              errors.push(
                `PEV Wait : ${FAI_PEV_MIN_MINUTES}–${FAI_PEV_MAX_MINUTES} min (Annexe A).`
              );
            }
            if (win < FAI_PEV_MIN_MINUTES || win > FAI_PEV_MAX_MINUTES) {
              errors.push(
                `PEV Window : ${FAI_PEV_MIN_MINUTES}–${FAI_PEV_MAX_MINUTES} min (Annexe A).`
              );
            }
          }
          break;
      }
    }

    if (regulation.startFai.pevEnabled && !regulation.cupOptions.noStart) {
      warnings.push(
        'PEV activé : renseignez l’heure d’ouverture du start (NoStart) si la compétition la publie.'
      );
    }

    if (regulation.startFai.maxStartGroundSpeedKmh) {
      warnings.push(
        `Vitesse sol max au départ : ${regulation.startFai.maxStartGroundSpeedKmh} km/h (contrôle sur trace IGC).`
      );
    }

    legs.forEach((leg, index) => {
      const wp = waypointsById.get(leg.waypointId);
      const zone = normalizeObservationZone(
        leg.obsZone,
        leg.role,
        this.radiusForLegRole(regulation, leg.role)
      );

      if (leg.role === 'departure' && !canWaypointBeDeparture(wp)) {
        const msg = `Point ${index + 1} : le décollage doit être un aérodrome.`;
        errors.push(msg);
        legIssues.push({ legIndex: index, severity: 'error', message: msg });
      }
      if (leg.role === 'arrival' && !canWaypointBeArrival(wp)) {
        const msg = `Point ${index + 1} : l’atterrissage doit être un aérodrome.`;
        errors.push(msg);
        legIssues.push({ legIndex: index, severity: 'error', message: msg });
      }

      if (regulation.constraints.includes('departure_must_be_line') && leg.role === 'departure') {
        if (!zone.line) {
          const msg = `Point ${index + 1} : ligne de départ requise.`;
          errors.push(msg);
          legIssues.push({ legIndex: index, severity: 'error', message: msg });
        }
      }

      if (regulation.constraints.includes('arrival_must_be_line') && leg.role === 'arrival') {
        if (!zone.line) {
          const msg = `Point ${index + 1} : ligne d’arrivée requise.`;
          errors.push(msg);
          legIssues.push({ legIndex: index, severity: 'error', message: msg });
        }
      }

      if (regulation.constraints.includes('departure_must_be_cylinder') && leg.role === 'departure') {
        if (zone.line) {
          const msg = `Point ${index + 1} : cylindre de départ requis (pas une ligne).`;
          errors.push(msg);
          legIssues.push({ legIndex: index, severity: 'error', message: msg });
        }
        const minR = regulation.startFai.cylinderMinRadiusM;
        if (zone.r1M < minR) {
          const msg = `Point ${index + 1} : rayon départ ≥ ${(minR / 1000).toFixed(0)} km.`;
          errors.push(msg);
          legIssues.push({ legIndex: index, severity: 'error', message: msg });
        }
      }
    });

    if (
      regulation.profileId === 'fai_cylinder_start' &&
      hasDeparture &&
      regulation.startFai.startKind === 'cylinder'
    ) {
      const depLeg = legs.find(l => l.role === 'departure');
      if (depLeg?.obsZone && depLeg.obsZone.r1M < FAI_CYLINDER_START_MIN_RADIUS_M) {
        warnings.push(
          `Cylindre de départ < ${FAI_CYLINDER_START_MIN_RADIUS_M / 1000} km : vérifiez la feuille de route.`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors: [...new Set(errors)],
      warnings: [...new Set(warnings)],
      legIssues
    };
  }

  getLegIssue(
    legIndex: number,
    validation: TaskRuleValidationResult
  ): TaskRuleLegIssue | undefined {
    const errors = validation.legIssues.filter(i => i.legIndex === legIndex && i.severity === 'error');
    if (errors.length) return errors[0];
    return validation.legIssues.find(i => i.legIndex === legIndex);
  }

  computeBeforeAfterPts(
    legs: CircuitLeg[],
    regulation: ResolvedTaskRegulation
  ): { beforePts: number; afterPts: number } {
    const hasDep = legs.length > 0 && legs[0].role === 'departure';
    const hasArr = legs.length > 0 && legs[legs.length - 1].role === 'arrival';
    const beforePts =
      regulation.cupOptions.beforePts ?? (hasDep ? 2 : 1);
    const afterPts =
      regulation.cupOptions.afterPts ?? (hasArr ? 2 : 1);
    return { beforePts, afterPts };
  }

  buildCupOptionsLine(legs: CircuitLeg[], regulation: ResolvedTaskRegulation): string {
    const { beforePts, afterPts } = this.computeBeforeAfterPts(legs, regulation);
    const parts: string[] = ['Options', `BeforePts=${beforePts}`, `AfterPts=${afterPts}`];

    if (regulation.cupOptions.wpDis != null) {
      parts.push(`WpDis=${regulation.cupOptions.wpDis ? 'True' : 'False'}`);
    }
    if (regulation.cupOptions.nearDisM != null) {
      const d = regulation.cupOptions.nearDisM;
      parts.push(d >= 1000 ? `NearDis=${(d / 1000).toFixed(1)}km` : `NearDis=${d}m`);
    }
    if (regulation.cupOptions.nearAltM != null) {
      parts.push(`NearAlt=${regulation.cupOptions.nearAltM}m`);
    }
    if (regulation.cupOptions.noStart) {
      parts.push(`NoStart=${regulation.cupOptions.noStart}`);
    }
    if (regulation.cupOptions.taskTime) {
      parts.push(`TaskTime=${regulation.cupOptions.taskTime}`);
    }

    return parts.join(',');
  }

  complianceSummary(regulation: ResolvedTaskRegulation): string[] {
    const lines: string[] = [
      `Règlement : ${regulation.label}`,
      regulation.description,
      `Rayons — départ ${regulation.radiiM.departureM} m · virage ${regulation.radiiM.turnpointM} m · arrivée ${regulation.radiiM.arrivalM} m`,
      `Départ : ${regulation.startFai.startKind === 'line' ? 'ligne' : 'cylindre'}`
    ];
    if (regulation.startFai.pevEnabled) {
      lines.push(
        `PEV — attente ${regulation.startFai.pevWaitMin} min, fenêtre ${regulation.startFai.pevWindowMin} min`
      );
    }
    lines.push(
      'Le scoring officiel (trace IGC, PEV sur enregistreur principal) reste du ressort du scorer.'
    );
    return lines;
  }

  allowedPresetsForRole(
    regulation: ResolvedTaskRegulation,
    role: CircuitLegRole
  ): ObsZonePresetId[] | null {
    if (regulation.profileId === 'custom') {
      return null;
    }
    const preset = regulation.obsZonePresetByRole[role];
    const base: ObsZonePresetId[] = [
      regulation.obsZonePresetByRole[role],
      'custom'
    ];
    if (role === 'departure') {
      if (regulation.constraints.includes('departure_must_be_line')) {
        return ['start_line', 'sector_to_next', 'custom'];
      }
      if (regulation.constraints.includes('departure_must_be_cylinder')) {
        return ['departure_cylinder', 'start_cylinder_fai', 'custom'];
      }
    }
    if (role === 'arrival' && regulation.constraints.includes('arrival_must_be_line')) {
      return ['finish_line', 'arrival_cylinder', 'custom'];
    }
    return [...new Set([preset, ...base])];
  }

  mergeOverrides(
    current: TaskRegulationOverrides,
    patch: TaskRegulationOverrides
  ): TaskRegulationOverrides {
    return {
      radiiM: { ...current.radiiM, ...patch.radiiM },
      cupOptions: { ...current.cupOptions, ...patch.cupOptions },
      startFai: { ...current.startFai, ...patch.startFai },
      constraints: patch.constraints ?? current.constraints
    };
  }
}
