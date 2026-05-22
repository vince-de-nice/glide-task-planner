import { Injectable, inject } from '@angular/core';
import { Popup, type MapLayerMouseEvent, type Map as MaplibreMap } from 'maplibre-gl';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { TranslateService } from '../i18n/translate.service';
import {
  applyAirspaceLayersToMap,
  removeAirspaceLayersFromMap
} from '../utils/airspace-map-layers.util';
import { enrichAirspaceCollectionWithDem } from '../utils/airspace-volume-enrich.util';
import type { AirspaceVolumeProperties } from '../utils/airspace-volume-enrich.util';
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

@Injectable({ providedIn: 'root' })
export class AirspaceMapDisplayService {
  private readonly airspaceLayer = inject(AirspaceLayerService);
  private readonly prefsService = inject(AirspaceScreenPrefsService);
  private readonly i18n = inject(TranslateService);

  private popup: Popup | null = null;
  private readonly cacheByScreen = new Map<AirspaceScreenId, ScreenAirspaceCache>();

  readPrefs(screenId: AirspaceScreenId): AirspaceScreenPrefs {
    return this.prefsService.get(screenId);
  }

  writePrefs(screenId: AirspaceScreenId, prefs: AirspaceScreenPrefs): void {
    this.prefsService.save(screenId, prefs);
  }

  getFilterOptions(screenId: AirspaceScreenId): AirspaceFilterFieldOptions | null {
    const cached = this.cacheByScreen.get(screenId);
    if (!cached) return null;
    return collectAirspaceFilterOptions(cached.enriched);
  }

  clearScreenCache(screenId: AirspaceScreenId): void {
    this.cacheByScreen.delete(screenId);
  }

  removeFromMap(map: MaplibreMap): void {
    this.popup?.remove();
    this.popup = null;
    removeAirspaceLayersFromMap(map);
  }

  getCachedEnriched(
    screenId: AirspaceScreenId
  ): FeatureCollection<Geometry, AirspaceVolumeProperties> | null {
    return this.cacheByScreen.get(screenId)?.enriched ?? null;
  }

  async applyToMap(
    map: MaplibreMap,
    screenId: AirspaceScreenId,
    beforeLayerId: string,
    options: {
      forceReload?: boolean;
      /** Sous-ensemble : uniquement ces clés de zone (après filtres prefs globaux). */
      legDisplayZoneKeys?: ReadonlySet<string>;
      /** Charge le cache POAFF enrichi sans ajouter les calques carte. */
      loadCacheOnly?: boolean;
    } = {}
  ): Promise<AirspaceMapApplyOutcome> {
    const prefs = this.prefsService.get(screenId);
    if (!prefs.visible) {
      this.removeFromMap(map);
      this.clearScreenCache(screenId);
      return { ok: true, status: null, volumeCount: 0, filterOptions: null };
    }

    await this.airspaceLayer.ensureConfigLoaded();
    await this.waitForTerrainReady(map);

    const useVolume3d = prefs.volume3d;
    const cached = this.cacheByScreen.get(screenId);
    const cacheValid =
      cached &&
      cached.regionId === prefs.regionId &&
      !options.forceReload;

    let result: AirspaceLoadResult;
    let enriched: FeatureCollection<Geometry, AirspaceVolumeProperties>;

    if (cacheValid) {
      result = cached.result;
      enriched = cached.enriched;
    } else {
      const loaded = await this.airspaceLayer.loadPoaffWithDiagnostics(prefs.regionId);
      if (!loaded.result?.geojson) {
        this.clearScreenCache(screenId);
        const msg = this.airspaceLayer.poaffFailureMessage(loaded.failure);
        return { ok: false, status: msg, volumeCount: 0, filterOptions: null };
      }

      result = loaded.result;
      const poaffFc = result.geojson as FeatureCollection<Geometry, PoaffProperties>;
      enriched = await enrichAirspaceCollectionWithDem(map, poaffFc);
      this.cacheByScreen.set(screenId, {
        regionId: prefs.regionId,
        result,
        enriched
      });
    }

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

    let filtered: FeatureCollection<Geometry, AirspaceVolumeProperties>;
    if (options.legDisplayZoneKeys) {
      filtered = {
        type: 'FeatureCollection',
        features: enriched.features.filter(f => {
          const k = airspaceZoneKey(f.properties, f.id);
          return k && options.legDisplayZoneKeys!.has(k);
        })
      };
    } else {
      const zoneFilters = normalizeAirspaceZoneFilters(
        prefs.zoneFilters,
        collectAirspaceFilterOptions(enriched).altitude
      );
      if (
        JSON.stringify(zoneFilters) !== JSON.stringify(prefs.zoneFilters)
      ) {
        this.prefsService.save(screenId, { ...prefs, zoneFilters });
      }
      filtered = filterAirspaceFeatureCollection(enriched, zoneFilters);
    }
    const volumeCount = filtered.features.filter(
      f => f.properties?.hasVolume === true
    ).length;
    const filterOptions = collectAirspaceFilterOptions(enriched);

    if (options.loadCacheOnly) {
      return { ok: true, status: null, volumeCount, filterOptions };
    }

    await applyAirspaceLayersToMap(map, openAipResult, filtered, {
      beforeLayerId,
      volume3d: useVolume3d,
      onFeatureClick: e => this.showPopup(map, e)
    });

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
