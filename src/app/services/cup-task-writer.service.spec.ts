import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { CupTaskWriterService } from './cup-task-writer.service';
import { TaskRuleEngineService } from './task-rule-engine.service';
import { CircuitLeg } from '../models/circuit.model';
import { TaskDeclaration } from '../models/task-declaration.model';

describe('CupTaskWriterService', () => {
  let writer: CupTaskWriterService;
  let ruleEngine: TaskRuleEngineService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    writer = TestBed.inject(CupTaskWriterService);
    ruleEngine = TestBed.inject(TaskRuleEngineService);
  });

  it('appends Related Tasks section', () => {
    const names = new Map([
      ['a', 'HOME'],
      ['t', 'TP1']
    ]);
    const decl: TaskDeclaration = {
      taskName: 'Test',
      declaredAtUtc: new Date(),
      warnings: [],
      points: [
        {
          name: 'HOME',
          cupName: 'HOME',
          latitude: 1,
          longitude: 2,
          role: 'start',
          radiusM: 400
        }
      ]
    };
    const legsWithZone: CircuitLeg[] = [
      {
        waypointId: 'a',
        role: 'departure',
        obsZone: { presetId: 'start_line', cupStyle: 2, r1M: 400, a1Deg: 180, line: true }
      },
      { waypointId: 't', role: 'turnpoint', obsZone: { presetId: 'cylinder_fixed', cupStyle: 0, r1M: 500 } }
    ];
    const reg = ruleEngine.resolveRegulation({ profileId: 'club', overrides: {} });
    const out = writer.appendTaskSection(
      'name,code\n"HOME"',
      legsWithZone,
      names,
      decl,
      400,
      reg
    );
    expect(out).toContain('-----Related Tasks-----');
    expect(out).toContain('Options,');
    expect(out).toContain('"0HOME"');
    expect(out).toContain('"1TP1"');
    expect(out).toContain('ObsZone=0,Style=2,R1=400m,A1=180,Line=1');
    expect(out).toContain('ObsZone=1,Style=0,R1=500m');
  });
});
