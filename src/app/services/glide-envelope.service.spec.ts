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
  it('excludes landables whose projection is before or after the leg segment', () => {
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

  it('excludes a landable only reachable via the extended line past an endpoint', () => {
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

    expect(ids).not.toContain('past');
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
