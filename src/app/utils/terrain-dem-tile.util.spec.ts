import { describe, expect, it } from 'vitest';
import {
  terrariumElevationFromRgb,
  tileCoordsAtTargetZoom
} from './terrain-dem-tile.util';

describe('terrain-dem-tile Terrarium decode', () => {
  it('decodes sea level (Terrarium / @watergis/terrain-rgb)', () => {
    // height = (R * 256 + G + B / 256) - 32768 → 0 m
    expect(terrariumElevationFromRgb(128, 0, 0)).toBe(0);
  });
});

describe('tileCoordsAtTargetZoom', () => {
  it('maps z15 cell to parent at z14', () => {
    expect(tileCoordsAtTargetZoom(17025, 11877, 15, 14)).toEqual({
      x: 8512,
      y: 5938
    });
  });
});
