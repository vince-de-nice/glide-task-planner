import { describe, expect, it } from 'vitest';
import {
  buildAirspaceWireframePositions,
  buildAirspaceWireframeSpecs,
  buildWireframeVerticalModel,
  wireframeVertexBaseM,
  wireframeVertexTopM
} from './airspace-wireframe.util';

describe('airspace-wireframe.util', () => {
  it('génère plancher + plafond + verticales pour un carré MSL', () => {
    const specs = buildAirspaceWireframeSpecs({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            hasVolume: true,
            extrusionBaseM: 1000,
            extrusionTopM: 2000,
            lower: 'FL100',
            upper: 'FL200',
            stroke: '#ff00ff'
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [1, 2],
                [2, 2],
                [2, 3],
                [1, 3],
                [1, 2]
              ]
            ]
          }
        }
      ]
    });

    expect(specs).toHaveLength(1);
    expect(specs[0].useTerrainBase).toBe(false);
    expect(specs[0].useTerrainTop).toBe(false);

    const positions = buildAirspaceWireframePositions(specs, null);
    expect(positions.length).toBe(4 * 3 * 2 * 3);
  });

  it('active le suivi relief pour limites AGL / GND', () => {
    const model = buildWireframeVerticalModel({
      hasVolume: true,
      extrusionBaseM: 1200,
      extrusionTopM: 2500,
      lower: 'GND',
      upper: '4500FT AGL',
      needsDemGround: true
    });

    expect(model?.useTerrainBase).toBe(true);
    expect(model?.useTerrainTop).toBe(true);
    expect(model?.baseOffsetM).toBe(0);
    expect(model?.topOffsetM).toBeCloseTo(4500 * 0.3048, 0);

    expect(wireframeVertexBaseM(model!, 800)).toBe(800);
    expect(wireframeVertexTopM(model!, 800)).toBeCloseTo(800 + 4500 * 0.3048, 0);
    expect(wireframeVertexBaseM(model!, 1200)).toBe(1200);
  });

  it('varie le plancher selon le relief par sommet (AGL)', () => {
    const specs = buildAirspaceWireframeSpecs({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            hasVolume: true,
            extrusionBaseM: 500,
            extrusionTopM: 2000,
            lower: 'GND',
            upper: '1000FT AGL',
            needsDemGround: true
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 0]
              ]
            ]
          }
        }
      ]
    });

    const map = {
      queryTerrainElevation: (coord: { lng: number; lat: number } | [number, number]) => {
        const lng = Array.isArray(coord) ? coord[0] : coord.lng;
        return 400 + lng * 100;
      }
    } as never;

    const positions = buildAirspaceWireframePositions(specs, map);
    expect(positions.length).toBeGreaterThan(0);
    const z0 = positions[2];
    const z1 = positions[8];
    expect(z1).not.toBe(z0);
  });
});
