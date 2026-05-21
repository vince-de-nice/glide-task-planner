import { Injectable } from '@angular/core';
import {
  TerrainDemMapService,
  type DemSegmentBounds
} from './terrain-dem-map.service';

/** Point d'échantillonnage le long d'une branche, altitudes en m MSL. */
export interface TerrainSample {
  /** Distance cumulée depuis le départ de la branche (km). */
  distanceKm: number;
  longitude: number;
  latitude: number;
  /** Altitude terrain (DEM Mapterhorn) — null si la tuile n'a pas pu être lue. */
  elevationM: number | null;
}

export interface LegProfile {
  fromLngLat: [number, number];
  toLngLat: [number, number];
  samples: TerrainSample[];
  /** Distance totale de la branche (km). */
  totalDistanceKm: number;
  /** Nombre d'échantillons retournés. */
  sampleCount: number;
  /** Vrai si au moins un échantillon est resté null (tuile manquante). */
  hasGaps: boolean;
}

const EARTH_RADIUS_KM = 6371;
const MIN_SAMPLES = 50;
const MAX_SAMPLES = 300;
const SAMPLE_PER_KM = 5;

/**
 * Échantillonnage du DEM le long des branches via une carte MapLibre dédiée
 * ({@link TerrainDemMapService}), avec cache des profils et des altitudes par point.
 */
@Injectable({ providedIn: 'root' })
export class TerrainProfileService {
  private readonly profileCache = new Map<string, LegProfile>();

  constructor(private readonly demMap: TerrainDemMapService) {}

  /**
   * @deprecated La carte visible n'est plus utilisée pour le DEM ; conservé pour compatibilité.
   */
  setMap(_map: unknown | null): void {
    /* no-op */
  }

  clearCache(): void {
    this.profileCache.clear();
    this.demMap.clearElevationCache();
  }

  /**
   * Précharge les tuiles DEM pour tous les segments du circuit (une vue, cache tuiles maximal).
   */
  async ensureDemForSegments(segments: DemSegmentBounds[]): Promise<void> {
    await this.demMap.ensureCoverage(segments);
  }

  /**
   * Échantillonne le DEM entre A et B (appeler {@link ensureDemForSegments} avant si possible).
   */
  sampleLegProfile(
    from: [number, number],
    to: [number, number],
    nbPoints?: number
  ): LegProfile {
    const totalDistanceKm = haversineKm(from, to);
    return this.sampleLegRange(from, to, 0, totalDistanceKm, nbPoints);
  }

  sampleLegRange(
    from: [number, number],
    to: [number, number],
    startDistanceKm: number,
    endDistanceKm: number,
    nbPoints?: number
  ): LegProfile {
    const totalDistanceKm = haversineKm(from, to);
    const spanKm = Math.max(0.01, endDistanceKm - startDistanceKm);
    const sampleCount =
      nbPoints ??
      clamp(Math.round(spanKm * SAMPLE_PER_KM), MIN_SAMPLES, MAX_SAMPLES);

    const key = cacheKeyRange(from, to, startDistanceKm, endDistanceKm, sampleCount);
    const cached = this.profileCache.get(key);
    if (cached) return cached;

    const samples: TerrainSample[] = [];
    for (let i = 0; i < sampleCount; i++) {
      const frac = sampleCount === 1 ? 0 : i / (sampleCount - 1);
      const distanceKm = startDistanceKm + spanKm * frac;
      const t = totalDistanceKm > 0 ? distanceKm / totalDistanceKm : 0;
      const point = interpolateGreatCircle(from, to, t);
      const elevation = this.demMap.queryElevation(point[0], point[1]);
      samples.push({
        distanceKm,
        longitude: point[0],
        latitude: point[1],
        elevationM: elevation
      });
    }

    const profile: LegProfile = {
      fromLngLat: from,
      toLngLat: to,
      samples,
      totalDistanceKm,
      sampleCount,
      hasGaps: samples.some(s => s.elevationM === null)
    };

    if (!profile.hasGaps) {
      this.profileCache.set(key, profile);
    }
    return profile;
  }

  applyEndpointTerrainFallback(
    profile: LegProfile,
    fromElevationM: number | null,
    toElevationM: number | null
  ): LegProfile {
    if (!profile.hasGaps) return profile;
    if (
      fromElevationM == null ||
      toElevationM == null ||
      !Number.isFinite(fromElevationM) ||
      !Number.isFinite(toElevationM)
    ) {
      return profile;
    }

    const total = profile.totalDistanceKm;
    if (total <= 0) return profile;

    const samples = profile.samples.map(s => {
      if (s.elevationM != null) return s;
      const t = clamp(s.distanceKm / total, 0, 1);
      return {
        ...s,
        elevationM: fromElevationM + (toElevationM - fromElevationM) * t
      };
    });

    return {
      ...profile,
      samples,
      hasGaps: samples.some(s => s.elevationM == null)
    };
  }
}

function cacheKeyRange(
  from: [number, number],
  to: [number, number],
  startKm: number,
  endKm: number,
  n: number
): string {
  const fx = from[0].toFixed(4);
  const fy = from[1].toFixed(4);
  const tx = to[0].toFixed(4);
  const ty = to[1].toFixed(4);
  return `${fx},${fy}->${tx},${ty}:[${startKm.toFixed(2)},${endKm.toFixed(2)}]@${n}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

function interpolateGreatCircle(
  from: [number, number],
  to: [number, number],
  t: number
): [number, number] {
  const [lon1, lat1] = from.map(toRad) as [number, number];
  const [lon2, lat2] = to.map(toRad) as [number, number];

  const x1 = Math.cos(lat1) * Math.cos(lon1);
  const y1 = Math.cos(lat1) * Math.sin(lon1);
  const z1 = Math.sin(lat1);
  const x2 = Math.cos(lat2) * Math.cos(lon2);
  const y2 = Math.cos(lat2) * Math.sin(lon2);
  const z2 = Math.sin(lat2);

  const dot = clamp(x1 * x2 + y1 * y2 + z1 * z2, -1, 1);
  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega);

  let xi: number;
  let yi: number;
  let zi: number;
  if (sinOmega < 1e-9) {
    xi = x1 + (x2 - x1) * t;
    yi = y1 + (y2 - y1) * t;
    zi = z1 + (z2 - z1) * t;
  } else {
    const a = Math.sin((1 - t) * omega) / sinOmega;
    const b = Math.sin(t * omega) / sinOmega;
    xi = a * x1 + b * x2;
    yi = a * y1 + b * y2;
    zi = a * z1 + b * z2;
  }
  const lat = Math.atan2(zi, Math.sqrt(xi * xi + yi * yi));
  const lon = Math.atan2(yi, xi);
  return [toDeg(lon), toDeg(lat)];
}
