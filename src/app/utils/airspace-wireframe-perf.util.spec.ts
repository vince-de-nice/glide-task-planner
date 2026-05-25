import { describe, expect, it } from 'vitest';
import {
  AIRSPACE_VIEWPORT_CULLING_ENABLED,
  filterAirspaceFeaturesForViewport,
  filterWireframeSpecsForViewport,
  maxRingVerticesForZoom
} from './airspace-wireframe-perf.util';
import type { AirspaceWireframeVolumeSpec } from './airspace-wireframe.util';

function specAt(lng: number, lat: number, size = 0.1): AirspaceWireframeVolumeSpec {
  return {
    id: `s-${lng}-${lat}`,
    ring: [
      { lng, lat },
      { lng: lng + size, lat },
      { lng: lng + size, lat: lat + size },
      { lng, lat: lat + size }
    ],
    bounds: {
      west: lng,
      south: lat,
      east: lng + size,
      north: lat + size
    },
    color: '#000',
    baseM: 0,
    topM: 1000,
    useTerrainBase: false,
    useTerrainTop: false,
    baseOffsetM: 0,
    topOffsetM: 0,
    needsTerrainSampling: false
  };
}

describe('airspace-wireframe-perf.util', () => {
  it('simplifie les anneaux selon le zoom', () => {
    expect(maxRingVerticesForZoom(7)).toBe(8);
    expect(maxRingVerticesForZoom(14)).toBe(32);
  });

  it.skipIf(!AIRSPACE_VIEWPORT_CULLING_ENABLED)(
    'garde toutes les zones dans le viewport, exclut les hors vue',
    () => {
    const map = {
      getZoom: () => 12,
      getBounds: () => ({
        getWest: () => 1,
        getSouth: () => 1,
        getEast: () => 3,
        getNorth: () => 3
      })
    } as never;

    const specs = [
      specAt(1.5, 1.5, 0.05),
      specAt(10, 10, 0.05),
      specAt(2, 2, 0.05),
      specAt(2.5, 2.5, 0.05)
    ];

    const filtered = filterWireframeSpecsForViewport(specs, map);
    expect(filtered.length).toBe(3);
    expect(filtered.some(s => s.id.startsWith('s-10'))).toBe(false);
    }
  );

  it('ne décime pas les anneaux AGL/GND (suivi relief)', () => {
    const denseRing = Array.from({ length: 120 }, (_, i) => ({
      lng: 6 + i * 0.001,
      lat: 45
    }));
    const terrainSpec: AirspaceWireframeVolumeSpec = {
      ...specAt(6, 45, 0.1),
      id: 'terrain-dense',
      ring: denseRing,
      needsTerrainSampling: true,
      useTerrainBase: true,
      useTerrainTop: true
    };
    const map = {
      getZoom: () => 10,
      getBounds: () => ({
        getWest: () => 5,
        getSouth: () => 44,
        getEast: () => 8,
        getNorth: () => 46
      })
    } as never;

    const filtered = filterWireframeSpecsForViewport([terrainSpec], map);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].ring.length).toBe(120);
  });

  it.skipIf(!AIRSPACE_VIEWPORT_CULLING_ENABLED)(
    'ne plafonne pas le nombre de features GeoJSON visibles',
    () => {
    const map = {
      getZoom: () => 11,
      getBounds: () => ({
        getWest: () => 0,
        getSouth: () => 0,
        getEast: () => 2,
        getNorth: () => 2
      })
    } as never;

    const features = Array.from({ length: 50 }, (_, i) => {
      const col = i % 10;
      const row = Math.floor(i / 10);
      const x = 0.1 + col * 0.15;
      const y = 0.1 + row * 0.15;
      return {
        geometry: {
          type: 'Polygon' as const,
          coordinates: [
            [
              [x, y],
              [x + 0.08, y],
              [x + 0.08, y + 0.08],
              [x, y + 0.08],
              [x, y]
            ]
          ]
        }
      };
    });

    expect(filterAirspaceFeaturesForViewport(features, map).length).toBe(50);
    }
  );
});
