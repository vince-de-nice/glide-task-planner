import { describe, it, expect } from 'vitest';
import { TaskValidationService } from './task-validation.service';
import { TaskDeclaration } from '../models/task-declaration.model';

describe('TaskValidationService', () => {
  const service = new TaskValidationService();

  it('rejects empty circuit', () => {
    const decl: TaskDeclaration = {
      taskName: 'X',
      declaredAtUtc: new Date(),
      points: [],
      warnings: []
    };
    const r = service.validateForExport([], decl);
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});
