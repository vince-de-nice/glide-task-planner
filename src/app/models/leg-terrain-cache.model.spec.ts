import { describe, expect, it } from 'vitest';
import {
  isLegTerrainCacheValid,
  legProfileFromTerrainCache,
  mergeTerrainCaches,
  terrainCacheCoversExtent,
  terrainCacheFromLegProfile,
  type LegTerrainCacheContext
} from './leg-terrain-cache.model';
import type { LegProfile } from './terrain-profile.types';

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
      {
        distanceKm: 0,
        longitude: 6.8,
        latitude: 46.2,
        elevationM: 400,
        elevationQuality: 'dem'
      },
      {
        distanceKm: 12.5,
        longitude: 6.95,
        latitude: 46.35,
        elevationM: 600,
        elevationQuality: 'dem'
      },
      {
        distanceKm: 25,
        longitude: 7.1,
        latitude: 46.5,
        elevationM: 800,
        elevationQuality: 'dem'
      }
    ]
  };

  it('round-trips a leg profile', () => {
    const cache = terrainCacheFromLegProfile(profile, ctx);
    expect(isLegTerrainCacheValid(cache, ctx)).toBe(true);
    const restored = legProfileFromTerrainCache(cache, ctx.fromLngLat, ctx.toLngLat);
    expect(restored.samples.length).toBe(3);
    expect(restored.samples[1].elevationM).toBe(600);
    expect(restored.samples[1].elevationQuality).toBe('dem');
    expect(cache.samples[1].q).toBe('d');
  });

  it('restores estimated quality from cache', () => {
    const cache = terrainCacheFromLegProfile(
      {
        ...profile,
        samples: [
          {
            distanceKm: 0,
            longitude: 6.8,
            latitude: 46.2,
            elevationM: 400,
            elevationQuality: 'estimated'
          },
          {
            distanceKm: 25,
            longitude: 7.1,
            latitude: 46.5,
            elevationM: 800,
            elevationQuality: 'dem'
          }
        ],
        hasGaps: true
      },
      ctx
    );
    const restored = legProfileFromTerrainCache(cache, ctx.fromLngLat, ctx.toLngLat);
    expect(restored.samples[0].elevationQuality).toBe('estimated');
    expect(restored.hasGaps).toBe(true);
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

  it('mergeTerrainCaches combines samples by distance', () => {
    const prev = terrainCacheFromLegProfile(profile, ctx);
    const extended: LegProfile = {
      ...profile,
      samples: [
        ...profile.samples,
        {
          distanceKm: 30,
          longitude: 7.2,
          latitude: 46.55,
          elevationM: 900,
          elevationQuality: 'dem-low'
        }
      ],
      sampleCount: 4
    };
    const merged = mergeTerrainCaches(prev, extended, ctx);
    expect(merged.samples.length).toBe(4);
    expect(merged.samples.find(s => s.distanceKm === 30)?.q).toBe('l');
    expect(merged.endKm).toBeGreaterThanOrEqual(30);
  });
});
