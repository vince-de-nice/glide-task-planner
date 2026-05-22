import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TerrainProfileService } from './terrain-profile.service';
import { TerrainElevationSamplerService } from './terrain-elevation-sampler.service';
import { TerrainSamplingProgressService } from './terrain-sampling-progress.service';
import type { TerrainSample } from '../models/terrain-profile.types';

describe('TerrainProfileService', () => {
  let service: TerrainProfileService;
  let sampler: {
    forEachChunk: ReturnType<typeof vi.fn>;
    fillSampleElevations: ReturnType<typeof vi.fn>;
    clearElevationCache: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    sampler = {
      forEachChunk: vi.fn(async (_seg, cb) => {
        await cb(0, 1);
      }),
      fillSampleElevations: vi.fn(async (samples: TerrainSample[]) => {
        for (const s of samples) {
          s.elevationM = 1200;
          s.demSampleQuality = 'dem';
        }
      }),
      clearElevationCache: vi.fn()
    };
    const progress = new TerrainSamplingProgressService();
    service = new TerrainProfileService(
      sampler as unknown as TerrainElevationSamplerService,
      progress
    );
  });

  it('samples elevations via dem sampler chunks', async () => {
    const from: [number, number] = [6.8, 46.2];
    const to: [number, number] = [6.85, 46.25];
    const profile = await service.sampleLegProfileAtDemZoom(from, to, 80);
    expect(sampler.forEachChunk).toHaveBeenCalled();
    expect(sampler.fillSampleElevations).toHaveBeenCalled();
    expect(profile.samples.every(s => s.elevationQuality === 'dem')).toBe(true);
    expect(profile.hasGaps).toBe(false);
  });

  it('applyEndpointTerrainFallback fills null elevations', () => {
    const profile = {
      fromLngLat: [0, 0] as [number, number],
      toLngLat: [0.1, 0.1] as [number, number],
      totalDistanceKm: 10,
      sampleCount: 3,
      hasGaps: true,
      samples: [
        { distanceKm: 0, longitude: 0, latitude: 0, elevationM: 1000 },
        { distanceKm: 5, longitude: 0.05, latitude: 0.05, elevationM: null },
        { distanceKm: 10, longitude: 0.1, latitude: 0.1, elevationM: 800 }
      ] as TerrainSample[]
    };
    const out = service.applyEndpointTerrainFallback(profile, 1000, 800);
    expect(out.hasGaps).toBe(false);
    expect(out.samples[1].elevationQuality).toBe('estimated');
    expect(out.samples[1].elevationM).toBe(900);
  });
});
