import { describe, expect, it } from 'vitest';
import { poaffCollectionFingerprint } from './airspace-poaff-fingerprint.util';

describe('poaffCollectionFingerprint', () => {
  it('changes when feature count or limits change', () => {
    const a = poaffCollectionFingerprint({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: '1', lower: 'GND', upper: 'FL100', lowerM: 0, upperM: 3000 },
          geometry: { type: 'Point', coordinates: [0, 0] }
        }
      ]
    });
    const b = poaffCollectionFingerprint({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: '1', lower: 'GND', upper: 'FL80', lowerM: 0, upperM: 2500 },
          geometry: { type: 'Point', coordinates: [0, 0] }
        }
      ]
    });
    expect(a).not.toBe(b);
  });

  it('distingue le filtre AREA/GEO de la source', () => {
    const fc = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: { id: '1', lower: 'GND', upper: 'FL100' },
          geometry: { type: 'Point' as const, coordinates: [0, 0] }
        }
      ]
    };
    expect(poaffCollectionFingerprint(fc)).not.toBe(
      poaffCollectionFingerprint(fc, { includeAreaGeo: true })
    );
  });
});
