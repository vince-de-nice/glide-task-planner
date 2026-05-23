import { Injectable, inject } from '@angular/core';
import { Popup, type MapLayerMouseEvent, type Map as MaplibreMap } from 'maplibre-gl';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { TranslateService } from '../i18n/translate.service';
import {
  applyAirspaceLayersToMap,
  removeAirspaceLayersFromMap
} from '../utils/airspace-map-layers.util';
import { isMapStyleActive } from '../utils/map-runtime.util';
import { getSerialQueue } from '../utils/serial-async-queue.util';
import { enrichAirspaceCollectionWithTerrarium } from '../utils/airspace-volume-enrich.util';
import type { AirspaceVolumeProperties } from '../utils/airspace-volume-enrich.util';
import { AirspaceTerrariumProgressService } from './airspace-terrarium-progress.service';
import {
  collectAirspaceFilterOptions,
  filterAirspaceFeatureCollection,
  normalizeAirspaceZoneFilters,
  type AirspaceFilterFieldOptions
} from '../utils/airspace-zone-filter.util';
import { airspaceZoneKey } from '../utils/leg-airspace-zone-filter.util';
import {
  AirspaceLayerService,
  type AirspaceLoadResult,
  type PoaffProperties
} from './airspace-layer.service';
import {
  AirspaceScreenPrefsService,
  type AirspaceScreenId,
  type AirspaceScreenPrefs
} from './airspace-screen-prefs.service';

export interface AirspaceMapApplyOutcome {
  ok: boolean;
  status: string | null;
  volumeCount: number;
  filterOptions: AirspaceFilterFieldOptions | null;
}

interface ScreenAirspaceCache {
  regionId: string;
  result: AirspaceLoadResult;
  enriched: FeatureCollection<Geometry, AirspaceVolumeProperties>;
}

const STALE_OUTCOME: AirspaceMapApplyOutcome = {
  ok: false,
  status: null,
  volumeCount: 0,
  filterOptions: null
};

/**
 * Charge le cache POAFF enrichi et applique les calques carte par écran.
 * Les opérations sur une même carte sont sérialisées ; l’invalidation (destroy)
 * annule uniquement les applies encore en attente.
 */
@Injectable({ providedIn: 'root' })
export class AirspaceMapDisplayService {
  private readonly airspaceLayer = inject(AirspaceLayerService);
  private readonly prefsService = inject(AirspaceScreenPrefsService);
  private readonly i18n = inject(TranslateService);
  private readonly terrariumProgress = inject(AirspaceTerrariumProgressService);

  private popup: Popup | null = null;
  /** Cache POAFF enrichi (Terrarium) partagé entre écrans pour une même région. */
  private readonly cacheByRegion = new Map<string, ScreenAirspaceCache>();
  private readonly regionQueueKeys = new Map<string, object>();
  /** Incrémenté à la destruction de carte pour abandonner les applies en cours. */
  private readonly invalidateEpochByMap = new WeakMap<MaplibreMap, number>();

  readPrefs(screenId: AirspaceScreenId): AirspaceScreenPrefs {
    return this.prefsService.get(screenId);
  }

  writePrefs(screenId: AirspaceScreenId, prefs: AirspaceScreenPrefs): void {
    this.prefsService.save(screenId, prefs);
  }

  getFilterOptions(screenId: AirspaceScreenId): AirspaceFilterFieldOptions | null {
    const cached = this.cacheByRegion.get(this.prefsService.get(screenId).regionId);
    if (!cached) return null;
    return collectAirspaceFilterOptions(cached.enriched);
  }

  clearScreenCache(screenId: AirspaceScreenId): void {
    const regionId = this.prefsService.get(screenId).regionId;
    this.cacheByRegion.delete(regionId);
  }

  getCachedEnriched(
    screenId: AirspaceScreenId
  ): FeatureCollection<Geometry, AirspaceVolumeProperties> | null {
    return this.cacheByRegion.get(this.prefsService.get(screenId).regionId)?.enriched ?? null;
  }

  /** Retire les calques sans invalider les chargements async. */
  clearLayersFromMap(map: MaplibreMap | null | undefined): void {
    if (!map) return;
    this.popup?.remove();
    this.popup = null;
    removeAirspaceLayersFromMap(map);
  }

  /** Destruction de carte : invalide les applies en attente puis retire les calques. */
  invalidateAndClearFromMap(map: MaplibreMap | null | undefined): void {
    if (!map) return;
    this.bumpInvalidateEpoch(map);
    this.clearLayersFromMap(map);
  }

  /** @deprecated Préférer clearLayersFromMap ou invalidateAndClearFromMap. */
  removeFromMap(map: MaplibreMap | null | undefined): void {
    this.clearLayersFromMap(map);
  }

  /**
   * Charge ou réutilise le cache POAFF enrichi pour un écran, sans toucher aux calques.
   */
  ensureEnrichedCache(
    map: MaplibreMap,
    screenId: AirspaceScreenId,
    options: { forceReload?: boolean } = {}
  ): Promise<AirspaceMapApplyOutcome> {
    const regionId = this.prefsService.get(screenId).regionId;
    return this.runForRegion(regionId, () =>
      this.loadEnrichedCache(screenId, options.forceReload === true, map)
    );
  }

  /**
   * Affiche sur la carte le sous-ensemble de zones d’une branche (profil sécurité).
   * Nécessite un cache déjà chaud (voir {@link ensureEnrichedCache}).
   */
  applyLegZonesToMap(
    map: MaplibreMap,
    screenId: AirspaceScreenId,
    beforeLayerId: string,
    legDisplayZoneKeys: ReadonlySet<string>
  ): Promise<AirspaceMapApplyOutcome> {
    if (legDisplayZoneKeys.size === 0) {
      this.clearLayersFromMap(map);
      return Promise.resolve({
        ok: true,
        status: null,
        volumeCount: 0,
        filterOptions: this.getFilterOptions(screenId)
      });
    }
    return this.applyToMap(map, screenId, beforeLayerId, { legDisplayZoneKeys });
  }

  /** Applique les filtres globaux de l’écran (carte tâche). */
  applyToMap(
    map: MaplibreMap,
    screenId: AirspaceScreenId,
    beforeLayerId: string,
    options: {
      forceReload?: boolean;
      legDisplayZoneKeys?: ReadonlySet<string>;
      loadCacheOnly?: boolean;
    } = {}
  ): Promise<AirspaceMapApplyOutcome> {
    return this.runOnMap(map, () =>
      this.applyToMapBody(map, screenId, beforeLayerId, options)
    );
  }

  private runOnMap<T>(map: MaplibreMap, fn: () => Promise<T>): Promise<T> {
    return getSerialQueue(map).enqueue(fn);
  }

  private runForRegion<T>(regionId: string, fn: () => Promise<T>): Promise<T> {
    let key = this.regionQueueKeys.get(regionId);
    if (!key) {
      key = {};
      this.regionQueueKeys.set(regionId, key);
    }
    return getSerialQueue(key).enqueue(fn);
  }

  private bumpInvalidateEpoch(map: MaplibreMap): void {
    this.invalidateEpochByMap.set(
      map,
      (this.invalidateEpochByMap.get(map) ?? 0) + 1
    );
  }

  private isInvalidated(map: MaplibreMap, epoch: number): boolean {
    return (this.invalidateEpochByMap.get(map) ?? 0) !== epoch;
  }

  private async applyToMapBody(
    map: MaplibreMap,
    screenId: AirspaceScreenId,
    beforeLayerId: string,
    options: {
      forceReload?: boolean;
      legDisplayZoneKeys?: ReadonlySet<string>;
      loadCacheOnly?: boolean;
    }
  ): Promise<AirspaceMapApplyOutcome> {
    const epoch = this.invalidateEpochByMap.get(map) ?? 0;

    const prefs = this.prefsService.get(screenId);
    const legScoped =
      screenId === 'safety-profile' || options.legDisplayZoneKeys != null;
    if (!prefs.visible && !legScoped) {
      this.clearLayersFromMap(map);
      this.clearScreenCache(screenId);
      return { ok: true, status: null, volumeCount: 0, filterOptions: null };
    }

    if (!isMapStyleActive(map)) {
      return STALE_OUTCOME;
    }

    const cacheOutcome = await this.loadEnrichedCache(
      screenId,
      options.forceReload === true,
      map
    );
    if (!cacheOutcome.ok) {
      return cacheOutcome;
    }
    if (this.isInvalidated(map, epoch) || !isMapStyleActive(map)) {
      return STALE_OUTCOME;
    }

    if (options.loadCacheOnly) {
      return cacheOutcome;
    }

    return this.paintFilteredCollection(
      map,
      screenId,
      beforeLayerId,
      prefs,
      options.legDisplayZoneKeys,
      epoch
    );
  }

  private async loadEnrichedCache(
    screenId: AirspaceScreenId,
    forceReload: boolean,
    _map: MaplibreMap | null
  ): Promise<AirspaceMapApplyOutcome> {
    const prefs = this.prefsService.get(screenId);

    await this.airspaceLayer.ensureConfigLoaded();

    const cached = this.cacheByRegion.get(prefs.regionId);
    const cacheValid = cached && !forceReload;

    let result: AirspaceLoadResult;
    let enriched: FeatureCollection<Geometry, AirspaceVolumeProperties>;

    if (cacheValid) {
      result = cached.result;
      enriched = cached.enriched;
    } else {
      const loaded = await this.airspaceLayer.loadPoaffWithDiagnostics(prefs.regionId);
      if (!loaded.result?.geojson) {
        this.clearScreenCache(screenId);
        this.terrariumProgress.cancel();
        const msg = this.airspaceLayer.poaffFailureMessage(loaded.failure);
        return { ok: false, status: msg, volumeCount: 0, filterOptions: null };
      }

      result = loaded.result;
      const poaffFc = result.geojson as FeatureCollection<Geometry, PoaffProperties>;
      const regionLabel = result.label.replace(/^POAFF — /, '');
      const zoneCount = poaffFc.features.length;

      this.terrariumProgress.begin(regionLabel, zoneCount);

      try {
        enriched = await enrichAirspaceCollectionWithTerrarium(poaffFc, {
          onProgress: p => {
            if (p.phase === 'prepare') {
              this.terrariumProgress.setPreparePercent(p.percent);
            } else if (p.phase === 'tiles') {
              this.terrariumProgress.setTileProgress(p.loadedTiles, p.totalTiles);
            } else {
              this.terrariumProgress.setEnrichProgress(p.processedZones, p.totalZones);
            }
          }
        });
      } finally {
        this.terrariumProgress.complete();
      }

      this.cacheByRegion.set(prefs.regionId, {
        regionId: prefs.regionId,
        result,
        enriched
      });
    }

    const volumeCount = enriched.features.filter(
      f => f.properties?.hasVolume === true
    ).length;
    const filterOptions = collectAirspaceFilterOptions(enriched);

    return { ok: true, status: null, volumeCount, filterOptions };
  }

  private async paintFilteredCollection(
    map: MaplibreMap,
    screenId: AirspaceScreenId,
    beforeLayerId: string,
    prefs: AirspaceScreenPrefs,
    legDisplayZoneKeys: ReadonlySet<string> | undefined,
    epoch: number
  ): Promise<AirspaceMapApplyOutcome> {
    const cached = this.cacheByRegion.get(prefs.regionId);
    if (!cached) {
      return STALE_OUTCOME;
    }

    const { result, enriched } = cached;
    const useVolume3d = prefs.volume3d;

    let openAipResult: AirspaceLoadResult = result;
    if (
      !useVolume3d &&
      this.airspaceLayer.hasOpenAipKey() &&
      (await this.airspaceLayer.createAirspaceLayer(prefs.regionId))?.source ===
        'openaip'
    ) {
      const oa = await this.airspaceLayer.createAirspaceLayer(prefs.regionId);
      if (oa) openAipResult = oa;
    }

    if (this.isInvalidated(map, epoch) || !isMapStyleActive(map)) {
      return STALE_OUTCOME;
    }

    let filtered: FeatureCollection<Geometry, AirspaceVolumeProperties>;
    if (legDisplayZoneKeys) {
      filtered = {
        type: 'FeatureCollection',
        features: enriched.features.filter(f => {
          const k = airspaceZoneKey(f.properties, f.id);
          return k && legDisplayZoneKeys.has(k);
        })
      };
    } else {
      const zoneFilters = normalizeAirspaceZoneFilters(
        prefs.zoneFilters,
        collectAirspaceFilterOptions(enriched).altitude
      );
      if (JSON.stringify(zoneFilters) !== JSON.stringify(prefs.zoneFilters)) {
        this.prefsService.save(screenId, { ...prefs, zoneFilters });
      }
      filtered = filterAirspaceFeatureCollection(enriched, zoneFilters);
    }

    const volumeCount = filtered.features.filter(
      f => f.properties?.hasVolume === true
    ).length;
    const filterOptions = collectAirspaceFilterOptions(enriched);

    if (this.isInvalidated(map, epoch) || !isMapStyleActive(map)) {
      return STALE_OUTCOME;
    }

    await applyAirspaceLayersToMap(map, openAipResult, filtered, {
      beforeLayerId,
      volume3d: useVolume3d,
      onFeatureClick: e => this.showPopup(map, e)
    });

    if (this.isInvalidated(map, epoch) || !isMapStyleActive(map)) {
      return STALE_OUTCOME;
    }

    const total = enriched.features.length;
    const shown = filtered.features.length;
    const status =
      useVolume3d || openAipResult.source !== 'openaip'
        ? this.i18n.t('map.airspacePoaffVolumes', {
            label: result.label.replace(/^POAFF — /, ''),
            count: volumeCount,
            shown,
            total
          })
        : this.i18n.t('map.airspaceOpenAip');

    return { ok: true, status, volumeCount, filterOptions };
  }

  private showPopup(map: MaplibreMap, e: MapLayerMouseEvent): void {
    const feat = e.features?.[0] as Feature<Geometry, PoaffProperties> | undefined;
    if (!feat?.geometry || e.lngLat == null) return;
    this.popup?.remove();
    this.popup = new Popup({ closeOnClick: true, maxWidth: '300px' })
      .setLngLat(e.lngLat)
      .setHTML(this.airspaceLayer.buildPoaffPopupHtml(feat))
      .addTo(map);
  }

  private waitForTerrainReady(map: MaplibreMap): Promise<void> {
    if (map.getTerrain()) {
      if (map.loaded()) return Promise.resolve();
      return new Promise(resolve => map.once('idle', () => resolve()));
    }
    return new Promise(resolve => {
      const onIdle = () => {
        map.off('idle', onIdle);
        resolve();
      };
      map.on('idle', onIdle);
      map.triggerRepaint();
    });
  }
}
