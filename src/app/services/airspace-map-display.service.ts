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
import {
  enrichAirspaceCollectionWithTerrarium,
  featureNeedsDemGround
} from '../utils/airspace-volume-enrich.util';
import type { AirspaceVolumeProperties } from '../utils/airspace-volume-enrich.util';
import { AirspaceTerrariumProgressService } from './airspace-terrarium-progress.service';
import { AirspaceEnrichedPersistService } from './airspace-enriched-persist.service';
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
import { AirspaceDataSourceService } from './airspace-data-source.service';
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
  sourceId: string;
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
  private readonly dataSource = inject(AirspaceDataSourceService);
  private readonly prefsService = inject(AirspaceScreenPrefsService);
  private readonly i18n = inject(TranslateService);
  private readonly terrariumProgress = inject(AirspaceTerrariumProgressService);
  private readonly enrichedPersist = inject(AirspaceEnrichedPersistService);

  private popup: Popup | null = null;
  /** Cache enrichi (Terrarium) partagé entre écrans pour une même source. */
  private readonly cacheBySource = new Map<string, ScreenAirspaceCache>();
  private readonly sourceQueueKeys = new Map<string, object>();
  /** Incrémenté à la destruction de carte pour abandonner les applies en cours. */
  private readonly invalidateEpochByMap = new WeakMap<MaplibreMap, number>();

  readPrefs(screenId: AirspaceScreenId): AirspaceScreenPrefs {
    return this.prefsService.get(screenId);
  }

  writePrefs(screenId: AirspaceScreenId, prefs: AirspaceScreenPrefs): void {
    this.prefsService.save(screenId, prefs);
  }

  getFilterOptions(_screenId: AirspaceScreenId): AirspaceFilterFieldOptions | null {
    const cached = this.cacheBySource.get(this.dataSource.activeSourceId());
    if (!cached) return null;
    return collectAirspaceFilterOptions(cached.enriched);
  }

  /** @deprecated utiliser invalidateActiveSourceCache */
  clearScreenCache(_screenId: AirspaceScreenId): void {
    this.invalidateActiveSourceCache();
  }

  invalidateActiveSourceCache(): void {
    const sourceId = this.dataSource.activeSourceId();
    this.cacheBySource.delete(sourceId);
    void this.enrichedPersist.delete(sourceId);
  }

  getCachedEnriched(
    _screenId: AirspaceScreenId
  ): FeatureCollection<Geometry, AirspaceVolumeProperties> | null {
    return this.cacheBySource.get(this.dataSource.activeSourceId())?.enriched ?? null;
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
    const sourceId = this.dataSource.activeSourceId();
    return this.runForSource(sourceId, () =>
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

  private runForSource<T>(sourceId: string, fn: () => Promise<T>): Promise<T> {
    let key = this.sourceQueueKeys.get(sourceId);
    if (!key) {
      key = {};
      this.sourceQueueKeys.set(sourceId, key);
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
    /** Carte circuit : visible piloté par l’appelant (reload uniquement si couche activée). */
    const taskMapApply = screenId === 'task-map';
    if (!taskMapApply && !prefs.visible && !legScoped) {
      this.clearLayersFromMap(map);
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

    const sourceId = this.dataSource.activeSourceId();
    const cached = this.cacheBySource.get(sourceId);
    const cacheValid = cached != null && !forceReload;

    let result: AirspaceLoadResult;
    let enriched: FeatureCollection<Geometry, AirspaceVolumeProperties>;

    if (cacheValid && cached) {
      result = cached.result;
      enriched = cached.enriched;
    } else {
      const loaded = await this.airspaceLayer.loadActiveWithDiagnostics();
      if (!loaded.result?.geojson) {
        this.clearScreenCache(screenId);
        this.terrariumProgress.cancel();
        const msg = this.airspaceLayer.poaffFailureMessage(loaded.failure);
        return { ok: false, status: msg, volumeCount: 0, filterOptions: null };
      }

      result = loaded.result;
      const poaffFc = result.geojson as FeatureCollection<Geometry, PoaffProperties>;
      const sourceFingerprint = this.enrichedPersist.fingerprintFromGeoJson(poaffFc);

      const persisted = await this.enrichedPersist.read(sourceId);
      if (
        !forceReload &&
        persisted &&
        this.enrichedPersist.matchesCurrentSource(persisted, sourceId, sourceFingerprint)
      ) {
        enriched = persisted.enriched;
        result = {
          source: 'poaff',
          label: persisted.label,
          geojson: poaffFc
        };
      } else {
        if (persisted && !this.enrichedPersist.matchesCurrentSource(persisted, sourceId, sourceFingerprint)) {
          void this.enrichedPersist.delete(sourceId);
        }
        const regionLabel = result.label.replace(/^(POAFF|Import) — /, '');
        const demZoneCount = poaffFc.features.filter(f =>
          featureNeedsDemGround(f.properties ?? {})
        ).length;

        this.terrariumProgress.begin(regionLabel, demZoneCount);

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

        void this.enrichedPersist.write({
          sourceId,
          sourceFingerprint,
          label: result.label,
          enriched
        });
      }

      this.cacheBySource.set(sourceId, {
        sourceId,
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
    const sourceId = this.dataSource.activeSourceId();
    const cached = this.cacheBySource.get(sourceId);
    if (!cached) {
      return STALE_OUTCOME;
    }

    const { result, enriched } = cached;
    const useVolume3d = prefs.volume3d;

    let openAipResult: AirspaceLoadResult = result;
    if (
      !useVolume3d &&
      this.airspaceLayer.hasOpenAipKey() &&
      (await this.airspaceLayer.createAirspaceLayer(sourceId))?.source ===
        'openaip'
    ) {
      const oa = await this.airspaceLayer.createAirspaceLayer(sourceId);
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
            label: result.label.replace(/^(POAFF|Import) — /, ''),
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
