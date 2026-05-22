import { describe, expect, it } from 'vitest';
import {
  landableColorFromId,
  landableColorsForIds,
  landableMapLabelColorFromHex,
  landableMapLabelColorFromId,
  LANDABLE_DISTINCT_HEX_PALETTE
} from './safety-profile-palette.util';

describe('safety-profile-palette', () => {
  it('returns hex colors compatible with Three.js', () => {
    const color = landableColorFromId('wp-a');
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(color).not.toBe('#ffffff');
  });

  it('assigns stable color per id', () => {
    expect(landableColorFromId('wp-a')).toBe(landableColorFromId('wp-a'));
    expect(landableColorFromId('wp-a')).not.toBe(landableColorFromId('wp-b'));
  });

  it('assigns evenly spaced palette colors on a branch', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `landable-${i}`);
    const map = landableColorsForIds(ids);
    const uniqueColors = new Set(map.values());
    expect(uniqueColors.size).toBe(8);
    expect(map.size).toBe(8);
    for (const c of map.values()) {
      expect(LANDABLE_DISTINCT_HEX_PALETTE).toContain(c);
    }
  });

  it('darkens label variant', () => {
    const base = landableColorFromId('wp-x');
    const label = landableMapLabelColorFromId('wp-x');
    const fromHex = landableMapLabelColorFromHex(base);
    expect(label).toMatch(/^#[0-9a-f]{6}$/i);
    expect(fromHex).toBe(label);
    expect(label).not.toBe(base);
  });
});
