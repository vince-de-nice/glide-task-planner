import { describe, expect, it } from 'vitest';
import { DEFAULT_SAFETY_PARAMS } from '../models/safety-params.model';
import type { Waypoint } from '../models/waypoint.model';
import { GlideEnvelopeService } from './glide-envelope.service';

const service = new GlideEnvelopeService();
const params = DEFAULT_SAFETY_PARAMS;

const leg = { fromLng: 5, fromLat: 44, toLng: 6, toLat: 44 };
const endpoints = { fromElevationM: 2500, toElevationM: 2500 };
/** ~78 km pour 1° de longitude à 44°N. */
const legLengthKm = 78;

function landable(
  id: string,
  lng: number,
  lat: number,
  elevation = 400
): Waypoint {
  return {
    id,
    name: id,
    type: 'landable',
    longitude: lng,
    latitude: lat,
    elevation
  };
}

describe('GlideEnvelopeService.filterIntersectingLandables', () => {
  it('includes a landable whose base is before the leg when its cone still reaches the segment', () => {
    const pastStart = landable('past', 4.85, 44.15);
    const ids = service
      .filterIntersectingLandables(
        [pastStart],
        params,
        leg,
        endpoints,
        legLengthKm,
        []
      )
      .map(l => l.id);

    expect(ids).toContain('past');
  });

  it('excludes landables too far from the leg for their cone to reach the segment', () => {
    const before = landable('before', 4.2, 44);
    const after = landable('after', 7.1, 44);
    const onLeg = landable('on', 5.5, 44.02);

    const ids = service
      .filterIntersectingLandables(
        [before, after, onLeg],
        params,
        leg,
        endpoints,
        legLengthKm,
        []
      )
      .map(l => l.id);

    expect(ids).not.toContain('before');
    expect(ids).not.toContain('after');
    expect(ids).toContain('on');
  });
});

describe('GlideEnvelopeService.computeProfileExtent', () => {
  it('extends the profile past leg ends when a cone base lies outside the segment', () => {
    const pastStart = landable('past', 4.85, 44.15);
    const extent = service.computeProfileExtent(
      legLengthKm,
      [pastStart],
      params,
      leg,
      endpoints,
      []
    );
    expect(extent.startKm).toBeLessThan(0);
  });
});

describe('GlideEnvelopeService.computeLegEnvelope', () => {
  it('sets hasTerrainGaps for missing or estimated, not dem-low alone', () => {
    const samples = [
      {
        distanceKm: 0,
        longitude: 5,
        latitude: 44,
        elevationM: 1000,
        elevationQuality: 'dem' as const
      },
      {
        distanceKm: 40,
        longitude: 5.5,
        latitude: 44,
        elevationM: 1100,
        elevationQuality: 'dem-low' as const
      },
      {
        distanceKm: 78,
        longitude: 6,
        latitude: 44,
        elevationM: 1200,
        elevationQuality: 'dem' as const
      }
    ];
    const envelope = service.computeLegEnvelope(
      samples,
      [],
      params,
      leg,
      endpoints,
      legLengthKm
    );
    expect(envelope.hasTerrainGaps).toBe(false);

    const withMissing = service.computeLegEnvelope(
      [
        ...samples.slice(0, 2),
        {
          distanceKm: 78,
          longitude: 6,
          latitude: 44,
          elevationM: null,
          elevationQuality: 'missing' as const
        }
      ],
      [],
      params,
      leg,
      endpoints,
      legLengthKm
    );
    expect(withMissing.hasTerrainGaps).toBe(true);
  });
});
