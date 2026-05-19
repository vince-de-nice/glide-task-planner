import { describe, it, expect } from 'vitest';
import {
  formatCupObsZoneLine,
  observationZoneFromPreset,
  defaultObservationZoneForRole
} from './observation-zone.model';

describe('observation-zone.model', () => {
  it('formats start line ObsZone per Naviter CUP', () => {
    const z = observationZoneFromPreset('start_line', 400);
    expect(formatCupObsZoneLine(0, z)).toBe('ObsZone=0,Style=2,R1=400m,A1=180,Line=1');
  });

  it('defaults departure to start line', () => {
    const z = defaultObservationZoneForRole('departure', 300);
    expect(z.line).toBe(true);
    expect(z.cupStyle).toBe(2);
  });
});
