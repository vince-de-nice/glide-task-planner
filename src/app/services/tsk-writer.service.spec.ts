import { describe, it, expect } from 'vitest';
import { TskWriterService } from './tsk-writer.service';
import { TaskDeclaration } from '../models/task-declaration.model';
import { CircuitLeg } from '../models/circuit.model';
import { Waypoint } from '../models/waypoint.model';

describe('TskWriterService', () => {
  const writer = new TskWriterService();

  it('generates task from legs with altitude and line zone', () => {
    const wp: Waypoint = {
      id: 'a',
      name: 'AD',
      latitude: 46.2,
      longitude: 14.1,
      elevation: 500,
      type: 'airfield'
    };
    const legs: CircuitLeg[] = [
      {
        waypointId: 'a',
        role: 'departure',
        obsZone: { cupStyle: 2, r1M: 400, a1Deg: 180, line: true },
        elevationM: 520
      }
    ];
    const xml = writer.generateFromLegs(legs, new Map([['a', wp]]), 'T');
    expect(xml).toContain('altitude="520"');
    expect(xml).toContain('type="Line"');
  });

  it('generates XCSoar task XML', () => {
    const decl: TaskDeclaration = {
      taskName: 'RT',
      declaredAtUtc: new Date(),
      warnings: [],
      points: [
        {
          name: 'Start',
          cupName: 'Start',
          latitude: 46.21,
          longitude: 14.1,
          role: 'start',
          radiusM: 400
        },
        {
          name: 'TP',
          cupName: 'TP',
          latitude: 46.5,
          longitude: 14.5,
          role: 'turn',
          radiusM: 500
        },
        {
          name: 'Finish',
          cupName: 'Finish',
          latitude: 46.21,
          longitude: 14.1,
          role: 'finish',
          radiusM: 400
        }
      ]
    };
    const xml = writer.generate(decl);
    expect(xml).toContain('<Task type="RT">');
    expect(xml).toContain('type="Start"');
    expect(xml).toContain('type="Turn"');
    expect(xml).toContain('type="Finish"');
    expect(xml).toContain('radius="500"');
  });
});
