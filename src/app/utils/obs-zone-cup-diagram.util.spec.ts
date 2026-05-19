import { describe, it, expect } from 'vitest';
import { buildObsZoneCupDiagram } from './obs-zone-cup-diagram.util';

describe('obs-zone-cup-diagram.util', () => {
  it('lists only applicable CUP parameters for plain cylinder', () => {
    const view = buildObsZoneCupDiagram({
      cupStyle: 0,
      r1M: 400,
      presetId: 'cylinder_fixed'
    });
    expect(view.params.map(p => p.key)).toEqual(['style', 'r1']);
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

  it('rotates schematic axis with referenceBearingDeg', () => {
    const zone = {
      cupStyle: 0 as const,
      r1M: 400,
      a1Deg: 90,
      a12Deg: 0,
      presetId: 'custom' as const
    };
    const northAxis = buildObsZoneCupDiagram(zone, 180);
    const eastAxis = buildObsZoneCupDiagram(zone, 270);
    const northStyle = northAxis.lines.find(l => l.paramKey === 'style');
    const eastStyle = eastAxis.lines.find(l => l.paramKey === 'style');
    expect(northStyle?.x2).not.toBeCloseTo(eastStyle?.x2 ?? 0, 0);
  });

  it('omits A12 from legend when style is not fixed', () => {
    const view = buildObsZoneCupDiagram(
      {
        cupStyle: 2,
        r1M: 500,
        a1Deg: 90,
        a12Deg: 45,
        presetId: 'custom'
      },
      90
    );
    expect(view.params.some(p => p.key === 'a12')).toBe(false);
  });

  it('keeps axis and A1 labels separated along the bearing', () => {
    const view = buildObsZoneCupDiagram(
      {
        cupStyle: 2,
        r1M: 2000,
        a1Deg: 180,
        presetId: 'custom'
      },
      164
    );
    const axis = view.labels.find(l => l.text.startsWith('axe'));
    const a1 = view.labels.find(l => l.text.startsWith('A1='));
    expect(axis).toBeDefined();
    expect(a1).toBeDefined();
    const dist = Math.hypot(axis!.x - a1!.x, axis!.y - a1!.y);
    expect(dist).toBeGreaterThanOrEqual(18);
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
