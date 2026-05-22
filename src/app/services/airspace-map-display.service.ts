import { Injectable, inject } from '@angular/core';
import { Popup, type MapLayerMouseEvent, type Map as MaplibreMap } from 'maplibre-gl';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { TranslateService } from '../i18n/translate.service';
import {
  applyAirspaceLayersToMap,
  removeAirspaceLayersFromMap
} from '../utils/airspace-map-layers.util';
import { enrichAirspaceCollectionWithDem } from '../utils/airspace-volume-enrich.util';
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
}

@Injectable({ providedIn: 'root' })
export class AirspaceMapDisplayService {
  private readonly airspaceLayer = inject(AirspaceLayerService);
  private readonly prefsService = inject(AirspaceScreenPrefsService);
  private readonly i18n = inject(TranslateService);

  private popup: Popup | null = null;

  readPrefs(screenId: AirspaceScreenId): AirspaceScreenPrefs {
    return this.prefsService.get(screenId);
  }

  writePrefs(screenId: AirspaceScreenId, prefs: AirspaceScreenPrefs): void {
    this.prefsService.save(screenId, prefs);
  }

  removeFromMap(map: MaplibreMap): void {
    this.popup?.remove();
    this.popup = null;
    removeAirspaceLayersFromMap(map);
  }

  async applyToMap(
    map: MaplibreMap,
    screenId: AirspaceScreenId,
    beforeLayerId: string
  ): Promise<AirspaceMapApplyOutcome> {
    const prefs = this.prefsService.get(screenId);
    if (!prefs.visible) {
      this.removeFromMap(map);
      return { ok: true, status: null, volumeCount: 0 };
    }

    await this.airspaceLayer.ensureConfigLoaded();
    await this.waitForTerrainReady(map);

    const useVolume3d = prefs.volume3d;
    const { result, failure } = await this.airspaceLayer.loadPoaffWithDiagnostics(
      prefs.regionId
    );

    if (!result?.geojson) {
      const msg = this.airspaceLayer.poaffFailureMessage(failure);
      return { ok: false, status: msg, volumeCount: 0 };
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

    const poaffFc = result.geojson as FeatureCollection<Geometry, PoaffProperties>;
    const enriched = await enrichAirspaceCollectionWithDem(map, poaffFc);
    const volumeCount = enriched.features.filter(
      f => f.properties?.hasVolume === true
    ).length;

    await applyAirspaceLayersToMap(map, openAipResult, enriched, {
      beforeLayerId,
      volume3d: useVolume3d,
      onFeatureClick: e => this.showPopup(map, e)
    });

    const status =
      useVolume3d || openAipResult.source !== 'openaip'
        ? this.i18n.t('map.airspacePoaffVolumes', {
            label: result.label.replace(/^POAFF — /, ''),
            count: volumeCount
          })
        : this.i18n.t('map.airspaceOpenAip');

    return { ok: true, status, volumeCount };
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
