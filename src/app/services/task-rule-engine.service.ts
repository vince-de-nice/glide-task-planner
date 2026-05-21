import { Injectable, inject } from '@angular/core';
import { TranslateService } from '../i18n/translate.service';
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
  private readonly i18n = inject(TranslateService);

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
      return { valid: false, errors: [this.i18n.t('rules.emptyCircuit')], warnings, legIssues };
    }

    const hasDeparture = legs.some(l => l.role === 'departure');
    const hasArrival = legs.some(l => l.role === 'arrival');
    const turnCount = legs.filter(l => l.role === 'turnpoint').length;

    for (const c of regulation.constraints) {
      switch (c) {
        case 'require_airfield_departure':
          if (!hasDeparture) {
            errors.push(this.i18n.t('rules.requireDepartureAirfield'));
          }
          break;
        case 'require_airfield_arrival':
          if (!hasArrival) {
            errors.push(this.i18n.t('rules.requireArrivalAirfield'));
          }
          break;
        case 'min_turnpoints':
          if (turnCount < 1) {
            errors.push(this.i18n.t('rules.minTurnpoints'));
          }
          break;
        case 'pev_wait_window_range':
          if (regulation.startFai.pevEnabled) {
            const w = regulation.startFai.pevWaitMin;
            const win = regulation.startFai.pevWindowMin;
            if (w < FAI_PEV_MIN_MINUTES || w > FAI_PEV_MAX_MINUTES) {
              errors.push(
                this.i18n.t('rules.pevWaitRange', {
                  min: FAI_PEV_MIN_MINUTES,
                  max: FAI_PEV_MAX_MINUTES
                })
              );
            }
            if (win < FAI_PEV_MIN_MINUTES || win > FAI_PEV_MAX_MINUTES) {
              errors.push(
                this.i18n.t('rules.pevWindowRange', {
                  min: FAI_PEV_MIN_MINUTES,
                  max: FAI_PEV_MAX_MINUTES
                })
              );
            }
          }
          break;
      }
    }

    if (regulation.startFai.pevEnabled && !regulation.cupOptions.noStart) {
      warnings.push(this.i18n.t('rules.pevNoStartWarn'));
    }

    if (regulation.startFai.maxStartGroundSpeedKmh) {
      warnings.push(
        this.i18n.t('rules.maxStartSpeedWarn', {
          speed: regulation.startFai.maxStartGroundSpeedKmh
        })
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
        const msg = this.i18n.t('rules.legDepartureAirfield', { index: index + 1 });
        errors.push(msg);
        legIssues.push({ legIndex: index, severity: 'error', message: msg });
      }
      if (leg.role === 'arrival' && !canWaypointBeArrival(wp)) {
        const msg = this.i18n.t('rules.legArrivalAirfield', { index: index + 1 });
        errors.push(msg);
        legIssues.push({ legIndex: index, severity: 'error', message: msg });
      }

      if (regulation.constraints.includes('departure_must_be_line') && leg.role === 'departure') {
        if (!zone.line) {
          const msg = this.i18n.t('rules.legDepartureLine', { index: index + 1 });
          errors.push(msg);
          legIssues.push({ legIndex: index, severity: 'error', message: msg });
        } else if (zone.cupStyle !== 2) {
          // Ligne de départ doit être Style 2 (vers point suivant), pas Style 3 (arrivée)
          const msg = this.i18n.t('rules.legDepartureLineStyle', { index: index + 1 });
          warnings.push(msg);
          legIssues.push({ legIndex: index, severity: 'warning', message: msg });
        }
      }

      if (regulation.constraints.includes('arrival_must_be_line') && leg.role === 'arrival') {
        if (!zone.line) {
          const msg = this.i18n.t('rules.legArrivalLine', { index: index + 1 });
          errors.push(msg);
          legIssues.push({ legIndex: index, severity: 'error', message: msg });
        } else if (zone.cupStyle !== 3) {
          // Ligne d'arrivée doit être Style 3 (vers point précédent), pas Style 2 (départ)
          const msg = this.i18n.t('rules.legArrivalLineStyle', { index: index + 1 });
          warnings.push(msg);
          legIssues.push({ legIndex: index, severity: 'warning', message: msg });
        }
      }

      if (regulation.constraints.includes('departure_must_be_cylinder') && leg.role === 'departure') {
        if (zone.line) {
          const msg = this.i18n.t('rules.legDepartureCylinder', { index: index + 1 });
          errors.push(msg);
          legIssues.push({ legIndex: index, severity: 'error', message: msg });
        }
        const minR = regulation.startFai.cylinderMinRadiusM;
        if (zone.r1M < minR) {
          const msg = this.i18n.t('rules.legDepartureRadius', {
            index: index + 1,
            km: (minR / 1000).toFixed(0)
          });
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
          this.i18n.t('rules.faiCylinderWarn', {
            km: FAI_CYLINDER_START_MIN_RADIUS_M / 1000
          })
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
    const profileId = regulation.profileId;
    const label = this.i18n.t(`regulation.profiles.${profileId}.label`);
    const description = this.i18n.t(`regulation.profiles.${profileId}.description`);
    const lines: string[] = [
      this.i18n.t('regulation.complianceRegulation', { label }),
      description,
      this.i18n.t('regulation.complianceRadii', {
        departure: regulation.radiiM.departureM,
        turn: regulation.radiiM.turnpointM,
        arrival: regulation.radiiM.arrivalM
      }),
      regulation.startFai.startKind === 'line'
        ? this.i18n.t('regulation.complianceStartLine')
        : this.i18n.t('regulation.complianceStartCylinder')
    ];
    if (regulation.startFai.pevEnabled) {
      lines.push(
        this.i18n.t('regulation.compliancePev', {
          wait: regulation.startFai.pevWaitMin,
          window: regulation.startFai.pevWindowMin
        })
      );
    }
    lines.push(this.i18n.t('regulation.complianceScoringNote'));
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
      // arrival_ring (Finish Ring >= 3 km) est également valide en FAI (§7.8.2 Annexe A)
      return ['finish_line', 'arrival_ring', 'arrival_cylinder', 'custom'];
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
