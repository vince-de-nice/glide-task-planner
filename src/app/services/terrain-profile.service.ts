import { Injectable } from '@angular/core';
import {
  DEM_SAMPLE_ZOOM,
  TerrainDemMapService,
  type DemSegmentBounds
} from './terrain-dem-map.service';
import {
  TerrainSamplingProgressService,
  type TerrainSamplingProgressContext
} from './terrain-sampling-progress.service';
import { interpolateGreatCircle } from '../utils/terrain-dem-chunk.util';

export type { TerrainSamplingProgressContext } from './terrain-sampling-progress.service';

/** Origine de l'altitude terrain affichée sur la coupe. */
export type TerrainElevationQuality = 'dem' | 'dem-low' | 'estimated' | 'missing';

/** Point d'échantillonnage le long d'une branche, altitudes en m MSL. */
export interface TerrainSample {
  /** Distance cumulée depuis le départ de la branche (km). */
  distanceKm: number;
  longitude: number;
  latitude: number;
  /** Altitude terrain (DEM Mapterhorn) — null si la tuile n'a pas pu être lue. */
  elevationM: number | null;
  /** Qualité de l'altitude (DEM, secours extrémités, ou trou). */
  elevationQuality?: TerrainElevationQuality;
  /** Transitoire après fetch tuile (avant {@link annotateTerrainQuality}). */
  demSampleQuality?: 'dem' | 'dem-low';
}

export interface LegProfile {
  fromLngLat: [number, number];
  toLngLat: [number, number];
  samples: TerrainSample[];
  /** Distance totale de la branche (km). */
  totalDistanceKm: number;
  /** Nombre d'échantillons retournés. */
  sampleCount: number;
  /** Vrai si au moins un échantillon est resté null (tuile manquante). */
  hasGaps: boolean;
}

const EARTH_RADIUS_KM = 6371;
const MIN_SAMPLES = 80;
const MAX_SAMPLES = 600;
const SAMPLE_PER_KM = 10;

/**
 * Échantillonnage du DEM le long des branches via fetch direct de tuiles Mapterhorn
 * ({@link TerrainDemMapService}, Terrarium z15, cache tuile).
 */
@Injectable({ providedIn: 'root' })
export class TerrainProfileService {
  private readonly profileCache = new Map<string, LegProfile>();

  constructor(
    private readonly demMap: TerrainDemMapService,
    private readonly samplingProgress: TerrainSamplingProgressService
  ) {}

  /**
   * @deprecated La carte visible n'est plus utilisée pour le DEM ; conservé pour compatibilité.
   */
  setMap(_map: unknown | null): void {
    /* no-op */
  }

  clearCache(): void {
    this.profileCache.clear();
    this.demMap.clearElevationCache();
  }

  /**
   * Échantillonne le DEM à z15 sur toute la branche (fenêtres successives + requête par fenêtre).
   */
  async sampleLegProfileAtDemZoom(
    from: [number, number],
    to: [number, number],
    nbPoints?: number,
    progress?: TerrainSamplingProgressContext
  ): Promise<LegProfile> {
    const totalDistanceKm = haversineKm(from, to);
    return this.sampleLegRangeAtDemZoom(from, to, 0, totalDistanceKm, nbPoints, progress);
  }

  /**
   * Échantillonne le DEM à z15 entre `startDistanceKm` et `endDistanceKm` le long de A→B.
   */
  async sampleLegRangeAtDemZoom(
    from: [number, number],
    to: [number, number],
    startDistanceKm: number,
    endDistanceKm: number,
    nbPoints?: number,
    progress?: TerrainSamplingProgressContext
  ): Promise<LegProfile> {
    const totalDistanceKm = haversineKm(from, to);
    const spanKm = Math.max(0.01, endDistanceKm - startDistanceKm);
    const sampleCount =
      nbPoints ??
      clamp(Math.round(spanKm * SAMPLE_PER_KM), MIN_SAMPLES, MAX_SAMPLES);

    const key =
      cacheKeyRange(from, to, startDistanceKm, endDistanceKm, sampleCount) +
      `@z${DEM_SAMPLE_ZOOM}`;
    const cached = this.profileCache.get(key);
    if (cached) return cached;

    const samples: TerrainSample[] = [];
    for (let i = 0; i < sampleCount; i++) {
      const frac = sampleCount === 1 ? 0 : i / (sampleCount - 1);
      const distanceKm = startDistanceKm + spanKm * frac;
      const t = totalDistanceKm > 0 ? distanceKm / totalDistanceKm : 0;
      const point = interpolateGreatCircle(from, to, t);
      samples.push({
        distanceKm,
        longitude: point[0],
        latitude: point[1],
        elevationM: null
      });
    }

    const tStart = totalDistanceKm > 0 ? startDistanceKm / totalDistanceKm : 0;
    const tEnd = totalDistanceKm > 0 ? endDistanceKm / totalDistanceKm : 1;
    const rangeSegment: DemSegmentBounds = {
      from: interpolateGreatCircle(from, to, tStart),
      to: interpolateGreatCircle(from, to, tEnd)
    };
    const legLabel = progress?.legLabel ?? null;
    await this.demMap.forEachChunk(rangeSegment, async (ci, chunkCount) => {
      if (progress) {
        this.samplingProgress.setDemChunk(
          progress.legIndex,
          progress.legCount,
          ci,
          chunkCount,
          legLabel
        );
      }
      const frac0 = ci / chunkCount;
      const frac1 = (ci + 1) / chunkCount;
      const dMin = startDistanceKm + spanKm * frac0 - 0.03;
      const dMax = startDistanceKm + spanKm * frac1 + 0.03;
      const chunkSamples = samples.filter(
        s => s.distanceKm >= dMin && s.distanceKm <= dMax && s.elevationM == null
      );
      await this.demMap.fillSampleElevations(chunkSamples);
    });

    const annotated = annotateTerrainQuality(samples);
    const profile: LegProfile = {
      fromLngLat: from,
      toLngLat: to,
      samples: annotated,
      totalDistanceKm,
      sampleCount,
      hasGaps: annotated.some(s => s.elevationM === null)
    };

    if (shouldCacheProfile(profile)) {
      this.profileCache.set(key, profile);
    }
    return profile;
  }

  /**
   * @deprecated Utiliser {@link sampleLegProfileAtDemZoom} (requiert tuiles z15 déjà chargées).
   */
  sampleLegProfile(
    from: [number, number],
    to: [number, number],
    nbPoints?: number
  ): LegProfile {
    const totalDistanceKm = haversineKm(from, to);
    return this.sampleLegRange(from, to, 0, totalDistanceKm, nbPoints);
  }

  sampleLegRange(
    from: [number, number],
    to: [number, number],
    startDistanceKm: number,
    endDistanceKm: number,
    nbPoints?: number
  ): LegProfile {
    const totalDistanceKm = haversineKm(from, to);
    const spanKm = Math.max(0.01, endDistanceKm - startDistanceKm);
    const sampleCount =
      nbPoints ??
      clamp(Math.round(spanKm * SAMPLE_PER_KM), MIN_SAMPLES, MAX_SAMPLES);

    const key = cacheKeyRange(from, to, startDistanceKm, endDistanceKm, sampleCount);
    const cached = this.profileCache.get(key);
    if (cached) return cached;

    const samples: TerrainSample[] = [];
    for (let i = 0; i < sampleCount; i++) {
      const frac = sampleCount === 1 ? 0 : i / (sampleCount - 1);
      const distanceKm = startDistanceKm + spanKm * frac;
      const t = totalDistanceKm > 0 ? distanceKm / totalDistanceKm : 0;
      const point = interpolateGreatCircle(from, to, t);
      const elevation = this.demMap.queryElevation(point[0], point[1]);
      samples.push({
        distanceKm,
        longitude: point[0],
        latitude: point[1],
        elevationM: elevation
      });
    }

    const profile: LegProfile = {
      fromLngLat: from,
      toLngLat: to,
      samples,
      totalDistanceKm,
      sampleCount,
      hasGaps: samples.some(s => s.elevationM === null)
    };

    if (shouldCacheProfile(profile)) {
      this.profileCache.set(key, profile);
    }
    return profile;
  }

  applyEndpointTerrainFallback(
    profile: LegProfile,
    fromElevationM: number | null,
    toElevationM: number | null
  ): LegProfile {
    if (!profile.hasGaps) return profile;
    if (
      fromElevationM == null ||
      toElevationM == null ||
      !Number.isFinite(fromElevationM) ||
      !Number.isFinite(toElevationM)
    ) {
      return profile;
    }

    const total = profile.totalDistanceKm;
    if (total <= 0) return profile;

    const samples = profile.samples.map(s => {
      if (s.elevationM != null) return s;
      const t = clamp(s.distanceKm / total, 0, 1);
      return {
        ...s,
        elevationM: fromElevationM + (toElevationM - fromElevationM) * t,
        elevationQuality: 'estimated' as const
      };
    });

    return {
      ...profile,
      samples: annotateTerrainQuality(samples),
      hasGaps: samples.some(s => s.elevationM == null)
    };
  }
}

function shouldCacheProfile(profile: LegProfile): boolean {
  return (
    !profile.hasGaps &&
    profile.samples.every(s => (s.elevationQuality ?? 'dem') === 'dem')
  );
}

function annotateTerrainQuality(samples: TerrainSample[]): TerrainSample[] {
  return samples.map(s => {
    if (s.elevationM == null) {
      return { ...s, elevationQuality: 'missing' as const };
    }
    if (s.elevationQuality === 'estimated') {
      return s;
    }
    if (s.demSampleQuality === 'dem-low') {
      return { ...s, elevationQuality: 'dem-low' as const };
    }
    return { ...s, elevationQuality: 'dem' as const };
  });
}

function cacheKeyRange(
  from: [number, number],
  to: [number, number],
  startKm: number,
  endKm: number,
  n: number
): string {
  const fx = from[0].toFixed(4);
  const fy = from[1].toFixed(4);
  const tx = to[0].toFixed(4);
  const ty = to[1].toFixed(4);
  return `${fx},${fy}->${tx},${ty}:[${startKm.toFixed(2)},${endKm.toFixed(2)}]@${n}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}
