import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { TaskRuleEngineService } from './task-rule-engine.service';
import { CircuitLeg } from '../models/circuit.model';
import { Waypoint } from '../models/waypoint.model';
import { TASK_RULE_PROFILES } from '../models/task-rule-profile.model';

describe('TaskRuleEngineService', () => {
  let service: TaskRuleEngineService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TaskRuleEngineService);
  });

  const wp = (id: string, type: Waypoint['type'] = 'airfield'): Waypoint => ({
    id,
    name: id,
    latitude: 46,
    longitude: 6,
    type,
    elevation: 500
  });

  it('builds CUP Options line with BeforePts/AfterPts', () => {
    const reg = service.resolveRegulation({ profileId: 'seeyou_standard', overrides: {} });
    const legs: CircuitLeg[] = [
      { waypointId: 'a', role: 'departure' },
      { waypointId: 't', role: 'turnpoint' },
      { waypointId: 'b', role: 'arrival' }
    ];
    const line = service.buildCupOptionsLine(legs, reg);
    expect(line).toMatch(/^Options,/);
    expect(line).toContain('BeforePts=2');
    expect(line).toContain('AfterPts=2');
    expect(line).toContain('WpDis=False');
  });

  it('fai_line_pev requires airfield ends', () => {
    const reg = service.resolveRegulation({ profileId: 'fai_line_pev', overrides: {} });
    const legs: CircuitLeg[] = [
      { waypointId: 't1', role: 'turnpoint' },
      { waypointId: 't2', role: 'turnpoint' }
    ];
    const map = new Map([
      ['t1', wp('t1', 'turnpoint')],
      ['t2', wp('t2', 'turnpoint')]
    ]);
    const r = service.validate(legs, map, reg);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('décollage'))).toBe(true);
  });

  it('applyProfileToLegs sets start line on departure', () => {
    const reg = service.resolveRegulation({ profileId: 'club', overrides: {} });
    const legs = service.applyProfileToLegs(
      [{ waypointId: 'a', role: 'departure' }],
      reg
    );
    expect(legs[0].obsZone?.line).toBe(true);
    expect(legs[0].obsZone?.presetId).toBe('start_line');
  });

  it('fai_cylinder_start uses 10km departure radius in profile', () => {
    const def = TASK_RULE_PROFILES.fai_cylinder_start;
    expect(def.radiiM.departureM).toBeGreaterThanOrEqual(10_000);
  });
});
