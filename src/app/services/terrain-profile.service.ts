import { Injectable } from '@angular/core';
import type { LegProfile, TerrainSample } from '../models/terrain-profile.types';
import {
  annotateTerrainQuality,
  isFullyDemProfile
} from '../utils/terrain-profile-quality.util';
import { haversineKm, interpolateGreatCircle } from '../utils/geo.util';
import {
  TerrainElevationSamplerService,
  type DemSegmentBounds
} from './terrain-elevation-sampler.service';
import {
  TerrainSamplingProgressService,
  type TerrainSamplingProgressContext
} from './terrain-sampling-progress.service';
import { DEM_SAMPLE_ZOOM } from '../utils/terrain-dem-chunk.util';

export type { TerrainSamplingProgressContext } from './terrain-sampling-progress.service';
export type {
  LegProfile,
  TerrainElevationQuality,
  TerrainSample
} from '../models/terrain-profile.types';

const MIN_SAMPLES = 80;
const MAX_SAMPLES = 600;
const SAMPLE_PER_KM = 10;

@Injectable({ providedIn: 'root' })
export class TerrainProfileService {
  private readonly profileCache = new Map<string, LegProfile>();

  constructor(
    private readonly demSampler: TerrainElevationSamplerService,
    private readonly samplingProgress: TerrainSamplingProgressService
  ) {}

  clearCache(): void {
    this.profileCache.clear();
    this.demSampler.clearElevationCache();
  }

  async sampleLegProfileAtDemZoom(
    from: [number, number],
    to: [number, number],
    nbPoints?: number,
    progress?: TerrainSamplingProgressContext
  ): Promise<LegProfile> {
    const totalDistanceKm = haversineKm(from, to);
    return this.sampleLegRangeAtDemZoom(from, to, 0, totalDistanceKm, nbPoints, progress);
  }

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
    await this.demSampler.forEachChunk(rangeSegment, async (ci, chunkCount) => {
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
      await this.demSampler.fillSampleElevations(chunkSamples);
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

    if (isFullyDemProfile(profile)) {
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
