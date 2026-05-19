import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { TaskValidationService } from './task-validation.service';
import { TaskRuleEngineService } from './task-rule-engine.service';
import { TaskDeclaration } from '../models/task-declaration.model';

describe('TaskValidationService', () => {
  let service: TaskValidationService;
  let ruleEngine: TaskRuleEngineService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TaskValidationService);
    ruleEngine = TestBed.inject(TaskRuleEngineService);
  });

  it('rejects empty circuit', () => {
    const decl: TaskDeclaration = {
      taskName: 'X',
      declaredAtUtc: new Date(),
      points: [],
      warnings: []
    };
    const reg = ruleEngine.resolveRegulation({ profileId: 'club', overrides: {} });
    const r = service.validateForExport([], decl, new Map(), reg);
    expect(r.errors.length).toBeGreaterThan(0);
    const regStrict = ruleEngine.resolveRegulation({ profileId: 'fai_line_pev', overrides: {} });
    const rStrict = service.validateForExport([], decl, new Map(), regStrict);
    expect(rStrict.valid).toBe(false);
  });
});
