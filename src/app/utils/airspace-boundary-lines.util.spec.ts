import { describe, expect, it } from 'vitest';
import { buildAirspaceBoundaryLineCollection } from './airspace-boundary-lines.util';

describe('buildAirspaceBoundaryLineCollection', () => {
  it('extrait un contour fermé par polygone', () => {
    const fc = buildAirspaceBoundaryLineCollection({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { stroke: '#111111', id: 'a1' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [1, 2],
                [3, 4],
                [5, 6],
                [1, 2]
              ]
            ]
          }
        }
      ]
    });

    expect(fc.features).toHaveLength(1);
    const coords = fc.features[0].geometry.coordinates;
    expect(coords[0]).toEqual([1, 2]);
    expect(coords[coords.length - 1]).toEqual([1, 2]);
    expect(fc.features[0].properties?.id).toBe('a1');
  });
});
