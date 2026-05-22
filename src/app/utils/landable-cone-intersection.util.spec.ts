import { describe, expect, it } from 'vitest';
import type { LandableConeVisual } from '../services/glide-envelope.service';
import {
  assignMapDisplayRadii,
  findCurvePairCrossings,
  MAP_CONE_OVERLAP_KM
} from './landable-cone-intersection.util';

const halfRatio = 17.5;

function cone(
  id: string,
  alongLegKm: number,
  curve: { distanceKm: number; altitudeM: number }[],
  baseAltitudeM = 500
): LandableConeVisual {
  return {
    id,
    name: id,
    shortName: id,
    type: 'landable',
    alongLegKm,
    crossTrackKm: 0.2,
    elevationM: baseAltitudeM - 250,
    baseAltitudeM,
    curve,
    isBinding: true,
    mapDisplayRadiusKm: 0,
    mapTopAltitudeM: baseAltitudeM
  };
}

describe('assignMapDisplayRadii', () => {
  it('ignores non-neighbor landables when sizing a cone', () => {
    const distances = [0, 20, 40, 60, 80];
    const near = cone(
      'near',
      5,
      distances.map((distanceKm, i) => ({
        distanceKm,
        altitudeM: 1200 + i * 20
      }))
    );
    const mid = cone(
      'mid',
      35,
      distances.map((distanceKm, i) => ({
        distanceKm,
        altitudeM: 1100 + i * 25
      }))
    );
    const far = cone(
      'far',
      200,
      distances.map((distanceKm, i) => ({
        distanceKm,
        altitudeM: 800 + i * 10
      }))
    );
    assignMapDisplayRadii([near, mid], halfRatio);
    const withMidOnly = near.mapDisplayRadiusKm;

    assignMapDisplayRadii([near, mid, far], halfRatio);
    expect(near.mapDisplayRadiusKm).toBe(withMidOnly);
    const handoffMid = (near.alongLegKm + mid.alongLegKm) / 2;
    expect(withMidOnly).toBeCloseTo(
      Math.hypot(handoffMid - near.alongLegKm, near.crossTrackKm) +
        MAP_CONE_OVERLAP_KM,
      1
    );
    expect(withMidOnly).toBeLessThan(
      Math.hypot(mid.alongLegKm - near.alongLegKm, near.crossTrackKm) +
        MAP_CONE_OVERLAP_KM
    );
  });

  it('adds only the configured overlap margin at a neighbor crossing', () => {
    const distances = [0, 10, 20, 30];
    const a = cone(
      'a',
      0,
      distances.map((distanceKm, i) => ({
        distanceKm,
        altitudeM: 1000 + i * 80
      }))
    );
    const b = cone(
      'b',
      25,
      distances.map((distanceKm, i) => ({
        distanceKm,
        altitudeM: 1300 - i * 80
      }))
    );

    const hits = findCurvePairCrossings(a.curve, b.curve);
    expect(hits.length).toBeGreaterThan(0);

    assignMapDisplayRadii([a, b], halfRatio, 0.5);

    const mid = (a.alongLegKm + b.alongLegKm) / 2;
    const hit = hits.reduce((best, h) =>
      Math.abs(h.distanceKm - mid) < Math.abs(best.distanceKm - mid) ? h : best
    );
    const reach = Math.hypot(
      Math.abs(hit.distanceKm - a.alongLegKm),
      a.crossTrackKm
    );
    expect(a.mapDisplayRadiusKm).toBeCloseTo(reach + 0.5, 1);
    expect(a.mapDisplayRadiusKm).toBeLessThan(
      Math.hypot(b.alongLegKm - a.alongLegKm, a.crossTrackKm) + 0.5
    );
  });
});
