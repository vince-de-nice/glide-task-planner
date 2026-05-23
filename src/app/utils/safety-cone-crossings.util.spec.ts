import { describe, expect, it } from 'vitest';
import type { EnvelopeSample, LandableConeVisual } from '../services/glide-envelope.service';
import {
  buildSafetyMinAltitudeCrossingLabelSpecs,
  collectActiveConeCrossings,
  SAFETY_MIN_ALT_CROSSING_LABEL_OFFSET_M
} from './safety-cone-crossings.util';

function sample(
  distanceKm: number,
  safetyM: number,
  lng: number,
  lat: number
): EnvelopeSample {
  return {
    distanceKm,
    longitude: lng,
    latitude: lat,
    terrainM: 1000,
    terrainQuality: 'dem',
    groundClearanceM: 1100,
    glideConeM: safetyM,
    safetyM,
    closestLandableId: null,
    closestLandableDistanceKm: null
  };
}

function cone(
  id: string,
  curve: Array<{ distanceKm: number; altitudeM: number }>
): LandableConeVisual {
  return {
    id,
    name: id,
    shortName: id,
    type: 'landable',
    alongLegKm: 5,
    crossTrackKm: 0,
    elevationM: 1200,
    baseAltitudeM: 1200,
    curve,
    isBinding: false,
    mapDisplayRadiusKm: 5,
    mapTopAltitudeM: 2000
  };
}

describe('collectActiveConeCrossings', () => {
  it('returns safety-line and on-envelope pair crossings', () => {
    const samples = [
      sample(0, 1500, 6, 45),
      sample(10, 1600, 6.1, 45.1),
      sample(20, 1700, 6.2, 45.2)
    ];
    const cones = [
      cone('a', [
        { distanceKm: 0, altitudeM: 2000 },
        { distanceKm: 10, altitudeM: 1500 },
        { distanceKm: 20, altitudeM: 1200 }
      ]),
      cone('b', [
        { distanceKm: 0, altitudeM: 1200 },
        { distanceKm: 10, altitudeM: 1550 },
        { distanceKm: 20, altitudeM: 2000 }
      ])
    ];
    const hits = collectActiveConeCrossings(cones, samples, () => '#336699');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    for (const hit of hits) {
      expect(hit.altitudeM).toBeGreaterThan(1000);
    }
  });

  it('places map labels on safetyM above the 3D ribbon', () => {
    const samples = [
      sample(0, 1500, 6, 45),
      sample(10, 1600, 6.1, 45.1),
      sample(20, 1700, 6.2, 45.2)
    ];
    const cones = [
      cone('a', [
        { distanceKm: 0, altitudeM: 2000 },
        { distanceKm: 10, altitudeM: 1500 },
        { distanceKm: 20, altitudeM: 1200 }
      ])
    ];
    const hits = collectActiveConeCrossings(cones, samples, () => '#336699');
    const specs = buildSafetyMinAltitudeCrossingLabelSpecs(hits, samples);
    expect(specs.length).toBeGreaterThan(0);
    const hit = hits[0];
    expect(specs[0].altitudeM).toBeCloseTo(
      hit.altitudeM + SAFETY_MIN_ALT_CROSSING_LABEL_OFFSET_M,
      0
    );
    expect(specs[0].label).toMatch(/1[\s,]?5\d{2}/);
  });
});
