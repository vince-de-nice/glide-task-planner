import { describe, expect, it, vi } from 'vitest';
import {
  lookupTerrainElevationM,
  queryTerrainElevationM
} from './map-terrain-elevation.util';

describe('map-terrain-elevation.util', () => {
  it('queryTerrainElevationM arrondit et gère les valeurs invalides', () => {
    const map = {
      queryTerrainElevation: vi.fn(() => 1847.6)
    } as never;
    expect(queryTerrainElevationM(map, 6.5, 44.2)).toBe(1848);
    expect(queryTerrainElevationM(null, 0, 0)).toBeUndefined();
    (map.queryTerrainElevation as ReturnType<typeof vi.fn>).mockReturnValue(null);
    expect(queryTerrainElevationM(map, 0, 0)).toBeUndefined();
  });

  it('lookupTerrainElevationM réessaie après idle si la première requête échoue', () => {
    const handlers: Record<string, () => void> = {};
    const map = {
      queryTerrainElevation: vi
        .fn()
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(1200),
      once: vi.fn((ev: string, fn: () => void) => {
        handlers[ev] = fn;
      }),
      off: vi.fn()
    } as never;

    const results: (number | undefined)[] = [];
    lookupTerrainElevationM(map, 6, 45, elev => results.push(elev));
    expect(results).toEqual([]);
    handlers['idle']?.();
    expect(results).toEqual([1200]);
  });
});
