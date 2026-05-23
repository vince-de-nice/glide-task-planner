import { describe, expect, it, vi } from 'vitest';
import { isMapStyleActive, registerMapTeardown, runMapTeardowns } from './map-runtime.util';

describe('map-runtime.util', () => {
  it('isMapStyleActive returns false for null or removed map', () => {
    expect(isMapStyleActive(null)).toBe(false);
    expect(isMapStyleActive(undefined)).toBe(false);

    const removed = {
      getStyle: () => ({}),
      _removed: true
    };
    expect(isMapStyleActive(removed as never)).toBe(false);
  });

  it('isMapStyleActive returns true when style is present', () => {
    const map = { getStyle: () => ({ version: 8 }) };
    expect(isMapStyleActive(map as never)).toBe(true);
  });

  it('registerMapTeardown runs on map remove', () => {
    const fn = vi.fn();
    const handlers = new Map<string, () => void>();
    const map = {
      getStyle: () => ({}),
      once: (event: string, cb: () => void) => {
        handlers.set(event, cb);
      }
    } as never;

    registerMapTeardown(map, fn);
    handlers.get('remove')?.();
    expect(fn).toHaveBeenCalledOnce();
    runMapTeardowns(map);
    expect(fn).toHaveBeenCalledOnce();
  });
});
