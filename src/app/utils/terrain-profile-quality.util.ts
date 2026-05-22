import type {
  LegProfile,
  TerrainElevationQuality,
  TerrainSample
} from '../models/terrain-profile.types';

export function profileTerrainQuality(
  sample: Pick<TerrainSample, 'elevationQuality' | 'elevationM'>
): TerrainElevationQuality {
  return (
    sample.elevationQuality ??
    (sample.elevationM == null ? 'missing' : 'dem')
  );
}

/** Profil entièrement issu du DEM pleine résolution (persistable + cache mémoire). */
export function isFullyDemProfile(profile: LegProfile): boolean {
  return (
    !profile.hasGaps &&
    profile.samples.length > 0 &&
    profile.samples.every(s => profileTerrainQuality(s) === 'dem')
  );
}

export function annotateTerrainQuality(samples: TerrainSample[]): TerrainSample[] {
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
