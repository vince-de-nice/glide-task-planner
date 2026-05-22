import { describe, expect, it } from 'vitest';
import {
  computeProfileLegCameraFit,
  profileMapBearingDeg
} from './safety-profile-map-fit.util';

describe('profileMapBearingDeg', () => {
  it('aligns an eastbound leg with north up (departure west, arrival east)', () => {
    const bearing = profileMapBearingDeg(46, 6, 46, 7);
    const delta = Math.min(bearing, 360 - bearing);
    expect(delta).toBeLessThan(1);
  });

  it('aligns a northbound leg with west up (departure south, arrival north)', () => {
    const bearing = profileMapBearingDeg(45, 6, 46, 6);
    expect(bearing).toBeCloseTo(270, 0);
  });
});

describe('computeProfileLegCameraFit', () => {
  const from = {
    id: 'a',
    name: 'A',
    latitude: 45.5,
    longitude: 5.5,
    type: 'landable' as const
  };
  const to = {
    id: 'b',
    name: 'B',
    latitude: 45.55,
    longitude: 6.05,
    type: 'landable' as const
  };

  it('returns a regional zoom for a ~50 km leg, not world scale', () => {
    const fit = computeProfileLegCameraFit({
      from,
      to,
      legLengthKm: 50,
      fitPoints: {
        from,
        to,
        samples: [],
        cones3d: false,
        enabledLandables: [],
        landableCones: [],
        enabledLandableIds: new Set()
      },
      viewportWidthPx: 900,
      viewportHeightPx: 420,
      paddingPx: { top: 56, bottom: 56, left: 40, right: 40 },
      maxZoom: 13
    });
    expect(fit).not.toBeNull();
    expect(fit!.zoom).toBeGreaterThan(8);
    expect(fit!.zoom).toBeLessThan(13.5);
    expect(fit!.center[0]).toBeGreaterThan(5);
    expect(fit!.center[0]).toBeLessThan(7);
    expect(fit!.center[1]).toBeGreaterThan(45);
    expect(fit!.center[1]).toBeLessThan(46);
  });
});
