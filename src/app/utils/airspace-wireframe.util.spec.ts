import { describe, expect, it } from 'vitest';
import {
  buildAirspaceWallMeshBuffers,
  buildAirspaceWireframePositions,
  buildAirspaceWireframeSpecs,
  buildWireframeVerticalModel,
  densifyRingVertices,
  wireframeVertexBaseM,
  wireframeVertexTopM
} from './airspace-wireframe.util';
import { FL999_CEILING_M } from './airspace-altitude.util';

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
    expect(positions.length).toBe(4 * 2 * 3);

    const walls = buildAirspaceWallMeshBuffers(specs, null);
    expect(walls.indices.length).toBe(4 * 6);
    expect(walls.positions.length).toBe(4 * 4 * 3);
  });

  it('utilise FL999 pour le plafond MSL du volume', () => {
    const model = buildWireframeVerticalModel({
      hasVolume: true,
      extrusionBaseM: 0,
      extrusionTopM: 999,
      lower: 'SFC',
      upper: 'FL999',
      upperM: 999
    });
    expect(model?.topM).toBeCloseTo(FL999_CEILING_M, 0);
    expect(model?.useTerrainTop).toBe(false);
  });

  it('exclut GEO et très grandes emprises du fil de fer 3D', () => {
    const franceRing = [
      { lng: -5, lat: 42 },
      { lng: 9, lat: 42 },
      { lng: 9, lat: 51 },
      { lng: -5, lat: 51 }
    ];
    const specs = buildAirspaceWireframeSpecs({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            hasVolume: true,
            type: 'GEO',
            class: 'AREA',
            extrusionBaseM: 0,
            extrusionTopM: FL999_CEILING_M,
            lower: 'SFC',
            upper: 'FL999'
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                ...franceRing.map((p) => [p.lng, p.lat]),
                [franceRing[0].lng, franceRing[0].lat]
              ]
            ]
          }
        }
      ]
    });
    expect(specs).toHaveLength(0);
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

  it('densifie un contour grossier pour le suivi AGL', () => {
    const coarse = [
      { lng: 0, lat: 0 },
      { lng: 0.5, lat: 0 },
      { lng: 0.5, lat: 0.4 },
      { lng: 0, lat: 0.4 }
    ];
    const dense = densifyRingVertices(coarse, 0.1);
    expect(dense.length).toBeGreaterThan(coarse.length);
  });

  it('construit plus de sommets pour une zone AGL qu’une zone FL', () => {
    const agl = buildAirspaceWireframeSpecs({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            hasVolume: true,
            extrusionBaseM: 500,
            extrusionTopM: 2000,
            lower: 'GND',
            upper: '2000FT AGL'
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [6.0, 45.0],
                [6.4, 45.0],
                [6.4, 45.3],
                [6.0, 45.3],
                [6.0, 45.0]
              ]
            ]
          }
        }
      ]
    });
    const fl = buildAirspaceWireframeSpecs({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            hasVolume: true,
            extrusionBaseM: 3000,
            extrusionTopM: 5000,
            lower: 'FL100',
            upper: 'FL150'
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [6.0, 45.0],
                [6.4, 45.0],
                [6.4, 45.3],
                [6.0, 45.3],
                [6.0, 45.0]
              ]
            ]
          }
        }
      ]
    });
    expect(agl[0].ring.length).toBeGreaterThan(fl[0].ring.length);
    expect(agl[0].needsTerrainSampling).toBe(true);
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
