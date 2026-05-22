import { Injectable, inject } from '@angular/core';
import type { CircuitLeg } from '../models/circuit.model';
import type { LegTerrainCache, LegTerrainCacheContext } from '../models/leg-terrain-cache.model';
import {
  isLegTerrainCacheValid,
  legProfileFromTerrainCache,
  mergeTerrainCaches,
  shouldPersistTerrainCache,
  terrainCacheCoversExtent,
  terrainCacheFromLegProfile
} from '../models/leg-terrain-cache.model';
import type { LegProfile } from '../models/terrain-profile.types';
import type { DemSamplingResult } from '../models/dem-sampling-result.model';
import type { SafetyParams } from '../models/safety-params.model';
import type { Waypoint } from '../models/waypoint.model';
import { haversineKm } from '../utils/geo.util';
import { landableColorFromId } from '../utils/safety-profile-chart.util';
import { resolveLegElevationM } from '../utils/elevation.util';
import { GlideEnvelopeService, type LegEnvelope } from './glide-envelope.service';
import { TerrainProfileService } from './terrain-profile.service';
import {
  TerrainSamplingProgressService,
  type TerrainSamplingProgressContext
} from './terrain-sampling-progress.service';

export interface SafetyLegPair {
  fromLeg: CircuitLeg;
  toLeg: CircuitLeg;
  from: Waypoint;
  to: Waypoint;
}

export interface LegLandableToggle {
  id: string;
  name: string;
  shortName: string;
  type: 'airfield' | 'landable';
  color: string;
  enabled: boolean;
}

export interface SafetyLegRender {
  index: number;
  fromWaypoint: Waypoint;
  toWaypoint: Waypoint;
  fromEndpoint: { name: string; elevationM: number | null };
  toEndpoint: { name: string; elevationM: number | null };
  distanceKm: number;
  envelope: LegEnvelope;
  landableToggles: LegLandableToggle[];
}

export interface ProcessLegProfileResult {
  render: SafetyLegRender;
  autoPruneIds?: readonly string[];
  terrainCache?: LegTerrainCache;
}

@Injectable({ providedIn: 'root' })
export class SafetyProfileTerrainFacade {
  private readonly terrainProfile = inject(TerrainProfileService);
  private readonly glideEnvelope = inject(GlideEnvelopeService);
  private readonly samplingProgress = inject(TerrainSamplingProgressService);

  async processLegProfile(
    idx: number,
    pair: SafetyLegPair,
    legCount: number,
    landables: Waypoint[],
    params: SafetyParams,
    options: { forceDemRefresh?: boolean } = {}
  ): Promise<DemSamplingResult<ProcessLegProfileResult>> {
    const progressCtx: TerrainSamplingProgressContext = {
      legIndex: idx,
      legCount,
      legLabel: `${pair.from.name} → ${pair.to.name}`
    };

    try {
      const result = await this.processLegProfileInner(
        idx,
        pair,
        legCount,
        landables,
        params,
        progressCtx,
        options
      );
      const hasGaps = result.render.envelope.hasTerrainGaps;
      return {
        status: hasGaps ? 'partial' : 'ok',
        reason: hasGaps ? 'partial-profile' : undefined,
        value: result
      };
    } catch (error) {
      return {
        status: 'failed',
        reason: 'network',
        error
      };
    }
  }

  clearDemCachesForRetry(): void {
    this.terrainProfile.clearCache();
  }

  private async processLegProfileInner(
    idx: number,
    pair: SafetyLegPair,
    legCount: number,
    landables: Waypoint[],
    params: SafetyParams,
    progressCtx: TerrainSamplingProgressContext,
    options: { forceDemRefresh?: boolean }
  ): Promise<ProcessLegProfileResult> {
    const fromLngLat: [number, number] = [pair.from.longitude, pair.from.latitude];
    const toLngLat: [number, number] = [pair.to.longitude, pair.to.latitude];
    const legGeo = {
      fromLng: pair.from.longitude,
      fromLat: pair.from.latitude,
      toLng: pair.to.longitude,
      toLat: pair.to.latitude
    };
    const fromElev = resolveLegElevationM(pair.from, pair.fromLeg);
    const toElev = resolveLegElevationM(pair.to, pair.toLeg);
    const endpoints = {
      fromElevationM: fromElev ?? null,
      toElevationM: toElev ?? null
    };
    const cacheCtx: LegTerrainCacheContext = {
      fromLngLat,
      toLngLat,
      fromElevationM: endpoints.fromElevationM,
      toElevationM: endpoints.toElevationM
    };
    const legLengthKm = haversineKm(fromLngLat, toLngLat);
    const forceDemRefresh = options.forceDemRefresh === true;

    let storedCache = pair.fromLeg.safetyOutgoing?.terrainCache;
    let initial: LegProfile;
    if (
      !forceDemRefresh &&
      isLegTerrainCacheValid(storedCache, cacheCtx) &&
      storedCache &&
      terrainCacheCoversExtent(storedCache, 0, legLengthKm)
    ) {
      initial = legProfileFromTerrainCache(storedCache, fromLngLat, toLngLat);
      this.samplingProgress.markTerrainReady(idx);
    } else {
      initial = await this.terrainProfile.sampleLegProfileAtDemZoom(
        fromLngLat,
        toLngLat,
        undefined,
        progressCtx
      );
      storedCache = terrainCacheFromLegProfile(initial, cacheCtx);
    }

    const isFirstProfileLoad = !pair.fromLeg.safetyOutgoing?.landablesAutoPruned;
    const disabledSet = new Set(
      isFirstProfileLoad
        ? []
        : (pair.fromLeg.safetyOutgoing?.disabledLandableIds ?? [])
    );
    const intersecting = this.glideEnvelope.filterIntersectingLandables(
      landables,
      params,
      legGeo,
      endpoints,
      initial.totalDistanceKm,
      initial.samples
    );
    const activeLandables = intersecting.filter(la => !disabledSet.has(la.id));

    const extentActive = this.glideEnvelope.computeProfileExtent(
      initial.totalDistanceKm,
      activeLandables,
      params,
      legGeo,
      endpoints,
      initial.samples
    );
    let profile = initial;
    const needsExtended =
      extentActive.startKm < 0 || extentActive.endKm > initial.totalDistanceKm;
    if (needsExtended) {
      if (
        !forceDemRefresh &&
        isLegTerrainCacheValid(storedCache, cacheCtx) &&
        storedCache &&
        terrainCacheCoversExtent(
          storedCache,
          extentActive.startKm,
          extentActive.endKm
        )
      ) {
        profile = legProfileFromTerrainCache(storedCache, fromLngLat, toLngLat);
        this.samplingProgress.markTerrainReady(idx);
      } else {
        profile = await this.terrainProfile.sampleLegRangeAtDemZoom(
          fromLngLat,
          toLngLat,
          extentActive.startKm,
          extentActive.endKm,
          undefined,
          progressCtx
        );
        const merged = mergeTerrainCaches(storedCache, profile, cacheCtx);
        storedCache = merged;
        profile = legProfileFromTerrainCache(merged, fromLngLat, toLngLat);
      }
    }

    this.samplingProgress.setComputeLeg(idx, legCount, progressCtx.legLabel);
    profile = this.terrainProfile.applyEndpointTerrainFallback(
      profile,
      fromElev ?? null,
      toElev ?? null
    );

    let terrainCache: LegTerrainCache | undefined;
    if (shouldPersistTerrainCache(profile)) {
      terrainCache = terrainCacheFromLegProfile(profile, cacheCtx);
    }

    let envelope = this.glideEnvelope.computeLegEnvelope(
      profile.samples,
      activeLandables,
      params,
      legGeo,
      endpoints,
      initial.totalDistanceKm
    );

    let autoPruneIds: readonly string[] | undefined;
    if (isFirstProfileLoad) {
      const toDisable =
        intersecting.length > 0
          ? this.glideEnvelope.findNonBindingLandableIds(
              envelope.samples,
              intersecting,
              params
            )
          : [];
      autoPruneIds = toDisable;
      for (const id of toDisable) {
        disabledSet.add(id);
      }
      if (toDisable.length > 0) {
        const prunedActive = intersecting.filter(la => !disabledSet.has(la.id));
        envelope = this.glideEnvelope.computeLegEnvelope(
          profile.samples,
          prunedActive,
          params,
          legGeo,
          endpoints,
          initial.totalDistanceKm
        );
      }
    }

    const landableToggles: LegLandableToggle[] = intersecting.map(la => ({
      id: la.id,
      name: la.name,
      shortName: la.code?.trim() || la.name,
      type: la.type === 'airfield' ? 'airfield' : 'landable',
      color: landableColorFromId(la.id),
      enabled: !disabledSet.has(la.id)
    }));

    this.samplingProgress.completeLeg(idx);

    return {
      render: {
        index: idx,
        fromWaypoint: pair.from,
        toWaypoint: pair.to,
        fromEndpoint: { name: pair.from.name, elevationM: fromElev ?? null },
        toEndpoint: { name: pair.to.name, elevationM: toElev ?? null },
        distanceKm: profile.totalDistanceKm,
        envelope,
        landableToggles
      },
      autoPruneIds,
      terrainCache
    };
  }
}
