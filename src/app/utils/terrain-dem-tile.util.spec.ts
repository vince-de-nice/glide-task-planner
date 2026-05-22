import { describe, expect, it } from 'vitest';
import { terrariumElevationFromRgb } from './terrain-dem-tile.util';

describe('terrain-dem-tile Terrarium decode', () => {
  it('decodes sea level (Terrarium / @watergis/terrain-rgb)', () => {
    // height = (R * 256 + G + B / 256) - 32768 → 0 m
    expect(terrariumElevationFromRgb(128, 0, 0)).toBe(0);
  });
});
