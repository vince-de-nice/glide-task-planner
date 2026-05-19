import { describe, it, expect } from 'vitest';
import { buildObsZoneCupDiagram } from './obs-zone-cup-diagram.util';

describe('obs-zone-cup-diagram.util', () => {
  it('returns all seven CUP parameters in legend', () => {
    const view = buildObsZoneCupDiagram({
      cupStyle: 0,
      r1M: 400,
      presetId: 'cylinder_fixed'
    });
    expect(view.params.map(p => p.key)).toEqual([
      'style',
      'r1',
      'a1',
      'r2',
      'a2',
      'a12',
      'line'
    ]);
    expect(view.params.filter(p => p.active).map(p => p.key)).toEqual(['style', 'r1']);
  });

  it('activates sector and ring params for FAI preset', () => {
    const view = buildObsZoneCupDiagram({
      cupStyle: 0,
      r1M: 30000,
      a1Deg: 45,
      r2M: 12000,
      a2Deg: 12,
      a12Deg: 123.4,
      presetId: 'sector_fai'
    });
    const active = view.params.filter(p => p.active).map(p => p.key);
    expect(active).toContain('a1');
    expect(active).toContain('r2');
    expect(active).toContain('a2');
    expect(active).toContain('a12');
    expect(view.arcs.length).toBeGreaterThan(0);
    expect(view.circles.length).toBe(2);
  });

  it('draws line when Line=1', () => {
    const view = buildObsZoneCupDiagram({
      cupStyle: 2,
      r1M: 500,
      a1Deg: 180,
      line: true,
      presetId: 'start_line'
    });
    expect(view.params.find(p => p.key === 'line')?.active).toBe(true);
    expect(view.lines.some(l => l.paramKey === 'line')).toBe(true);
  });
});
