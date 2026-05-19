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
    expect(view.labels.some(l => l.text.startsWith('R1'))).toBe(true);
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
    expect(view.labels.some(l => l.text.startsWith('A1'))).toBe(true);
    expect(view.labels.some(l => l.text.startsWith('R2'))).toBe(true);
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
    const southAxis = buildObsZoneCupDiagram(zone, 180);
    const westAxis = buildObsZoneCupDiagram(zone, 270);
    expect(southAxis.styleArrow?.x2).not.toBeCloseTo(westAxis.styleArrow?.x2 ?? 0, 0);
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
    expect(view.labels.some(l => l.text.startsWith('A12'))).toBe(false);
  });

  it('keeps labels separated when axis points near north', () => {
    const view = buildObsZoneCupDiagram(
      {
        cupStyle: 2,
        r1M: 2000,
        a1Deg: 180,
        r2M: 1200,
        a2Deg: 80,
        presetId: 'custom'
      },
      345
    );
    const north = view.labels.find(l => l.text === 'N')!;
    const others = view.labels.filter(l => l.text !== 'N');
    expect(others.length).toBeGreaterThanOrEqual(3);

    for (let i = 0; i < others.length; i++) {
      for (let j = i + 1; j < others.length; j++) {
        const dist = Math.hypot(others[i].x - others[j].x, others[i].y - others[j].y);
        expect(dist).toBeGreaterThanOrEqual(16);
      }
      const distN = Math.hypot(others[i].x - north.x, others[i].y - north.y);
      expect(distN).toBeGreaterThanOrEqual(20);
    }
  });

  it('shows axis bearing in Style legend hint for sectors', () => {
    const view = buildObsZoneCupDiagram(
      {
        cupStyle: 2,
        r1M: 2000,
        a1Deg: 180,
        presetId: 'custom'
      },
      345
    );
    const styleParam = view.params.find(p => p.key === 'style');
    expect(styleParam?.hint).toContain('345°');
    expect(view.labels.some(l => l.paramKey === 'style' && l.text === '345°')).toBe(true);
  });

  it('places param labels with leaders on the geometry', () => {
    const view = buildObsZoneCupDiagram(
      {
        cupStyle: 2,
        r1M: 2000,
        a1Deg: 180,
        presetId: 'custom'
      },
      345
    );
    const a1 = view.labels.find(l => l.text.startsWith('A1'));
    expect(a1?.leader).toBeDefined();
    expect(view.labels.find(l => l.text === 'N')).toBeDefined();
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
    expect(view.labels.some(l => l.text === 'Line')).toBe(true);
  });
});
