import { DEM_SAMPLE_ZOOM } from '../utils/terrain-dem-chunk.util';
import type { LegProfile, TerrainSample } from '../services/terrain-profile.service';

/** Incrémenter si le format ou le zoom DEM change. */
export const LEG_TERRAIN_CACHE_VERSION = 1;

export interface LegTerrainCacheSample {
  distanceKm: number;
  longitude: number;
  latitude: number;
  elevationM: number | null;
}

/** Profil terrain DEM persisté sur la branche sortante (localStorage via circuit). */
export interface LegTerrainCache {
  version: number;
  demZoom: number;
  fromLng: number;
  fromLat: number;
  toLng: number;
  toLat: number;
  fromElevationM: number | null;
  toElevationM: number | null;
  totalDistanceKm: number;
  startKm: number;
  endKm: number;
  sampleCount: number;
  samples: LegTerrainCacheSample[];
}

export interface LegTerrainCacheContext {
  fromLngLat: [number, number];
  toLngLat: [number, number];
  fromElevationM: number | null;
  toElevationM: number | null;
}

function roundCoord(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

function roundElev(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value);
}

function coordsMatch(
  a: [number, number],
  bLng: number,
  bLat: number
): boolean {
  return roundCoord(a[0]) === roundCoord(bLng) && roundCoord(a[1]) === roundCoord(bLat);
}

/** Vrai si le cache correspond à la géométrie et aux extrémités actuelles. */
export function isLegTerrainCacheValid(
  cache: LegTerrainCache | undefined,
  ctx: LegTerrainCacheContext
): boolean {
  if (!cache) return false;
  if (cache.version !== LEG_TERRAIN_CACHE_VERSION) return false;
  if (cache.demZoom !== DEM_SAMPLE_ZOOM) return false;
  if (!coordsMatch(ctx.fromLngLat, cache.fromLng, cache.fromLat)) return false;
  if (!coordsMatch(ctx.toLngLat, cache.toLng, cache.toLat)) return false;
  if (roundElev(ctx.fromElevationM) !== roundElev(cache.fromElevationM)) return false;
  if (roundElev(ctx.toElevationM) !== roundElev(cache.toElevationM)) return false;
  if (!cache.samples.length) return false;
  if (cache.samples.some(s => s.elevationM == null || !Number.isFinite(s.elevationM))) {
    return false;
  }
  return true;
}

export function terrainCacheCoversExtent(
  cache: LegTerrainCache,
  startKm: number,
  endKm: number
): boolean {
  return cache.startKm <= startKm + 1e-4 && cache.endKm >= endKm - 1e-4;
}

export function legProfileFromTerrainCache(
  cache: LegTerrainCache,
  fromLngLat: [number, number],
  toLngLat: [number, number]
): LegProfile {
  const samples: TerrainSample[] = cache.samples.map(s => ({
    distanceKm: s.distanceKm,
    longitude: s.longitude,
    latitude: s.latitude,
    elevationM: s.elevationM
  }));
  return {
    fromLngLat,
    toLngLat,
    samples,
    totalDistanceKm: cache.totalDistanceKm,
    sampleCount: cache.sampleCount,
    hasGaps: false
  };
}

export function terrainCacheFromLegProfile(
  profile: LegProfile,
  ctx: LegTerrainCacheContext
): LegTerrainCache {
  const startKm = profile.samples[0]?.distanceKm ?? 0;
  const endKm =
    profile.samples[profile.samples.length - 1]?.distanceKm ??
    profile.totalDistanceKm;
  return {
    version: LEG_TERRAIN_CACHE_VERSION,
    demZoom: DEM_SAMPLE_ZOOM,
    fromLng: roundCoord(ctx.fromLngLat[0]),
    fromLat: roundCoord(ctx.fromLngLat[1]),
    toLng: roundCoord(ctx.toLngLat[0]),
    toLat: roundCoord(ctx.toLngLat[1]),
    fromElevationM: roundElev(ctx.fromElevationM),
    toElevationM: roundElev(ctx.toElevationM),
    totalDistanceKm: profile.totalDistanceKm,
    startKm,
    endKm,
    sampleCount: profile.sampleCount,
    samples: profile.samples.map(s => ({
      distanceKm: s.distanceKm,
      longitude: s.longitude,
      latitude: s.latitude,
      elevationM: s.elevationM
    }))
  };
}

/** Compare métadonnées du cache (sans sérialiser les milliers d'échantillons). */
export function terrainCacheMetaEqual(
  a: LegTerrainCache | undefined,
  b: LegTerrainCache | undefined
): boolean {
  if (!a || !b) return false;
  return (
    a.version === b.version &&
    a.demZoom === b.demZoom &&
    a.fromLng === b.fromLng &&
    a.fromLat === b.fromLat &&
    a.toLng === b.toLng &&
    a.toLat === b.toLat &&
    a.fromElevationM === b.fromElevationM &&
    a.toElevationM === b.toElevationM &&
    a.totalDistanceKm === b.totalDistanceKm &&
    a.startKm === b.startKm &&
    a.endKm === b.endKm &&
    a.sampleCount === b.sampleCount
  );
}

export function mergeTerrainCaches(
  prev: LegTerrainCache | undefined,
  profile: LegProfile,
  ctx: LegTerrainCacheContext
): LegTerrainCache {
  const next = terrainCacheFromLegProfile(profile, ctx);
  if (!prev || !isLegTerrainCacheValid(prev, ctx)) {
    return next;
  }

  const byDistance = new Map<number, LegTerrainCacheSample>();
  for (const s of prev.samples) {
    byDistance.set(Math.round(s.distanceKm * 1e5), s);
  }
  for (const s of next.samples) {
    byDistance.set(Math.round(s.distanceKm * 1e5), s);
  }
  const samples = [...byDistance.values()].sort(
    (a, b) => a.distanceKm - b.distanceKm
  );
  return {
    ...next,
    startKm: Math.min(prev.startKm, next.startKm),
    endKm: Math.max(prev.endKm, next.endKm),
    sampleCount: samples.length,
    samples
  };
}
