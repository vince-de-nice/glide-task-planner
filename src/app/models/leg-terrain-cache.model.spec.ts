import { describe, expect, it } from 'vitest';
import {
  isLegTerrainCacheValid,
  legProfileFromTerrainCache,
  terrainCacheCoversExtent,
  terrainCacheFromLegProfile,
  type LegTerrainCacheContext
} from './leg-terrain-cache.model';
import type { LegProfile } from '../services/terrain-profile.service';

describe('leg-terrain-cache', () => {
  const ctx: LegTerrainCacheContext = {
    fromLngLat: [6.8, 46.2],
    toLngLat: [7.1, 46.5],
    fromElevationM: 400,
    toElevationM: 800
  };

  const profile: LegProfile = {
    fromLngLat: ctx.fromLngLat,
    toLngLat: ctx.toLngLat,
    totalDistanceKm: 25,
    sampleCount: 3,
    hasGaps: false,
    samples: [
      { distanceKm: 0, longitude: 6.8, latitude: 46.2, elevationM: 400 },
      { distanceKm: 12.5, longitude: 6.95, latitude: 46.35, elevationM: 600 },
      { distanceKm: 25, longitude: 7.1, latitude: 46.5, elevationM: 800 }
    ]
  };

  it('round-trips a leg profile', () => {
    const cache = terrainCacheFromLegProfile(profile, ctx);
    expect(isLegTerrainCacheValid(cache, ctx)).toBe(true);
    const restored = legProfileFromTerrainCache(cache, ctx.fromLngLat, ctx.toLngLat);
    expect(restored.samples.length).toBe(3);
    expect(restored.samples[1].elevationM).toBe(600);
  });

  it('invalidates when coordinates change', () => {
    const cache = terrainCacheFromLegProfile(profile, ctx);
    expect(
      isLegTerrainCacheValid(cache, {
        ...ctx,
        toLngLat: [7.2, 46.5]
      })
    ).toBe(false);
  });

  it('detects extent coverage', () => {
    const cache = terrainCacheFromLegProfile(profile, ctx);
    expect(terrainCacheCoversExtent(cache, 0, 25)).toBe(true);
    expect(terrainCacheCoversExtent(cache, -1, 25)).toBe(false);
  });
});
