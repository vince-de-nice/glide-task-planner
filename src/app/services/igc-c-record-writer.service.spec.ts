import { describe, it, expect } from 'vitest';
import { IgcCRecordWriterService } from './igc-c-record-writer.service';
import { TaskDeclaration } from '../models/task-declaration.model';

describe('IgcCRecordWriterService', () => {
  const writer = new IgcCRecordWriterService();

  it('generates header and point lines', () => {
    const declaration: TaskDeclaration = {
      taskName: '500K Triangle',
      declaredAtUtc: new Date(Date.UTC(2015, 7, 21, 9, 38, 41)),
      warnings: [],
      points: [
        {
          name: 'Lasham Clubhouse',
          cupName: 'Lasham Clubhouse',
          latitude: 51.18932,
          longitude: -1.03165,
          role: 'takeoff'
        },
        {
          name: 'Lasham Start S',
          cupName: 'Lasham Start S',
          latitude: 51.16965,
          longitude: -1.04407,
          role: 'start'
        },
        {
          name: 'Sarnesfield',
          cupName: 'Sarnesfield',
          latitude: 52.15153,
          longitude: -2.92045,
          role: 'turn'
        }
      ]
    };
    const out = writer.generate(declaration, 1);
    expect(out).toContain('C 21 08 15 09 38 41 000000 0000 01 500K Triangle');
    expect(out).toContain('TAKEOFF');
    expect(out).toContain('START');
    expect(out).toContain('TURN Sarnesfield');
  });
});
