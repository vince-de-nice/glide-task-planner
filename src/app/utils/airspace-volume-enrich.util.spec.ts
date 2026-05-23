import { describe, expect, it, vi } from 'vitest';
import type { FeatureCollection, Polygon } from 'geojson';
import type { PoaffProperties } from '../services/airspace-layer.service';
import {
  enrichAirspaceCollectionWithTerrarium,
  type AirspaceVolumeProperties
} from './airspace-volume-enrich.util';

vi.mock('./terrain-dem-tile.util', () => ({
  fillTerrariumElevations: vi.fn(
    async (
      samples: { longitude: number; latitude: number; elevationM: number | null }[],
      _zoom?: number,
      onProgress?: (p: { loadedTiles: number; totalTiles: number }) => void
    ) => {
      onProgress?.({ loadedTiles: 0, totalTiles: 1 });
      for (const s of samples) {
        s.elevationM = 420;
      }
      onProgress?.({ loadedTiles: 1, totalTiles: 1 });
    }
  )
}));

describe('enrichAirspaceCollectionWithTerrarium', () => {
  it('samples ground for every zone via Terrarium', async () => {
    const collection: FeatureCollection<Polygon, PoaffProperties> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            id: 'z1',
            lower: 'GND',
            upper: 'FL100',
            lowerM: 0,
            upperM: 3000
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [2, 48],
                [2.1, 48],
                [2.1, 48.1],
                [2, 48.1],
                [2, 48]
              ]
            ]
          }
        },
        {
          type: 'Feature',
          properties: {
            id: 'z2',
            lower: '5000FT',
            upper: 'FL80',
            lowerM: 1500,
            upperM: 2500
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [3, 49],
                [3.2, 49],
                [3.2, 49.2],
                [3, 49.2],
                [3, 49]
              ]
            ]
          }
        }
      ]
    };

    const phases: string[] = [];
    const enriched = await enrichAirspaceCollectionWithTerrarium(collection, {
      onProgress: p => phases.push(p.phase)
    });

    expect(enriched.features).toHaveLength(2);
    const z1 = enriched.features[0].properties as AirspaceVolumeProperties;
    const z2 = enriched.features[1].properties as AirspaceVolumeProperties;
    expect(z1.sampledGroundM).toBe(420);
    expect(z2.sampledGroundM).toBeUndefined();
    expect(phases).toContain('prepare');
    expect(phases).toContain('tiles');
    expect(phases).toContain('enrich');
  });
});
