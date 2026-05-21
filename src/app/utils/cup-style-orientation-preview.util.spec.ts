import { describe, it, expect } from 'vitest';
import { buildCupStyleOrientationPreview } from './cup-style-orientation-preview.util';
import type { ObsZoneLegContext } from './obs-zone-map.util';

const wp = (name: string, lat: number, lon: number) => ({
  id: name,
  name,
  latitude: lat,
  longitude: lon,
  type: 'turnpoint' as const
});

describe('buildCupStyleOrientationPreview', () => {
  const ctx: ObsZoneLegContext = {
    legIndex: 1,
    leg: { waypointId: 'b', role: 'turnpoint' },
    waypoint: wp('B', 46, 6),
    prev: wp('A', 46, 5.9),
    next: wp('C', 46.1, 6.1),
    departure: wp('D', 45.9, 5.8),
    defaultRadiusM: 400
  };

  const base = { cupStyle: 0 as const, r1M: 400, a1Deg: 90 };

  it('style 3 uses previous waypoint and axis bearing', () => {
    const p = buildCupStyleOrientationPreview(3, ctx, base);
    expect(p.referenceKey).toBe('zoneCup.styleOrientation.ref3');
    expect(p.axisAvailable).toBe(true);
    const prev = p.markers.find(m => m.kind === 'prev');
    expect(prev?.available).toBe(true);
    expect(prev?.name).toBe('A');
  });

  it('style 2 missing next is flagged', () => {
    const p = buildCupStyleOrientationPreview(2, { ...ctx, next: null }, base);
    expect(p.referenceKey).toBe('zoneCup.styleOrientation.ref2missing');
    expect(p.axisAvailable).toBe(false);
  });
});
