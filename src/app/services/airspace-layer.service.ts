import { Injectable, inject } from '@angular/core';
import { TranslateService } from '../i18n/translate.service';
import { geoJSON, GeoJSON, Layer, PathOptions, TileLayer, tileLayer } from 'leaflet';
import type { Feature, FeatureCollection, Geometry } from 'geojson';

import {
  DEFAULT_POAFF_REGION_ID,
  OPENAIP_TILE_URL,
  POAFF_AIRSPACE_REGIONS,
  poaffRegionAssetUrl,
  poaffRegionProxyUrl,
  PoaffRegion
} from '../config/map-airspace.config';

export type AirspaceSource = 'openaip' | 'poaff' | 'none';

export interface AirspaceLoadResult {
  layer: Layer;
  source: AirspaceSource;
  label: string;
}

export type AirspaceLoadFailure =
  | 'network'
  | 'not_found'
  | 'parse'
  | 'unknown';

interface PoaffProperties {
  id?: string;
  nameV?: string;
  class?: string;
  type?: string;
  lower?: string;
  upper?: string;
  desc?: string;
  stroke?: string;
  'stroke-width'?: number;
  fill?: string;
  'stroke-opacity'?: number;
  'fill-opacity'?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AirspaceLayerService {
  private readonly i18n = inject(TranslateService);
  private openAipApiKey: string | null = null;
  private configLoaded = false;

  readonly poaffRegions = POAFF_AIRSPACE_REGIONS;

  async ensureConfigLoaded(): Promise<void> {
    if (this.configLoaded) return;
    try {
      const response = await fetch('/config/airspace.json');
      if (response.ok) {
        const data = (await response.json()) as { openAipApiKey?: string };
        const key = data.openAipApiKey?.trim();
        if (key) this.openAipApiKey = key;
      }
    } catch {
      /* config optionnelle */
    }
    this.configLoaded = true;
  }

  setOpenAipApiKey(key: string | null): void {
    this.openAipApiKey = key?.trim() || null;
    this.configLoaded = true;
  }

  hasOpenAipKey(): boolean {
    return !!this.openAipApiKey;
  }

  async createAirspaceLayer(
    regionId: string = DEFAULT_POAFF_REGION_ID
  ): Promise<AirspaceLoadResult | null> {
    await this.ensureConfigLoaded();

    if (this.openAipApiKey) {
      return {
        layer: this.createOpenAipTileLayer(this.openAipApiKey),
        source: 'openaip',
        label: 'OpenAIP'
      };
    }

    const region = POAFF_AIRSPACE_REGIONS.find(r => r.id === regionId);
    if (!region) return null;

    const loaded = await this.loadPoaffGeoJson(region);
    if (!loaded.layer) return null;

    return {
      layer: loaded.layer,
      source: 'poaff',
      label: `POAFF — ${region.label}`
    };
  }

  async loadPoaffWithDiagnostics(
    regionId: string = DEFAULT_POAFF_REGION_ID
  ): Promise<{ result: AirspaceLoadResult | null; failure?: AirspaceLoadFailure }> {
    await this.ensureConfigLoaded();
    if (this.openAipApiKey) {
      const result = await this.createAirspaceLayer(regionId);
      return { result };
    }

    const region = POAFF_AIRSPACE_REGIONS.find(r => r.id === regionId);
    if (!region) return { result: null, failure: 'unknown' };

    const loaded = await this.loadPoaffGeoJson(region);
    if (loaded.layer) {
      return {
        result: {
          layer: loaded.layer,
          source: 'poaff',
          label: `POAFF — ${region.label}`
        }
      };
    }
    return { result: null, failure: loaded.failure ?? 'unknown' };
  }

  private createOpenAipTileLayer(apiKey: string): TileLayer {
    return tileLayer(`${OPENAIP_TILE_URL}?apiKey=${encodeURIComponent(apiKey)}`, {
      pane: 'airspace',
      tms: true,
      opacity: 0.72,
      maxNativeZoom: 14,
      maxZoom: 19,
      attribution:
        this.i18n.t('map.attribution')
    });
  }

  private async loadPoaffGeoJson(
    region: PoaffRegion
  ): Promise<{ layer: GeoJSON | null; failure?: AirspaceLoadFailure }> {
    const urls = [poaffRegionAssetUrl(region), poaffRegionProxyUrl(region)];
    let lastFailure: AirspaceLoadFailure = 'not_found';

    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (response.status === 404) {
          lastFailure = 'not_found';
          continue;
        }
        if (!response.ok) {
          lastFailure = 'network';
          continue;
        }
        const data = (await response.json()) as FeatureCollection;
        if (!data?.features?.length) {
          lastFailure = 'parse';
          continue;
        }
        return {
          layer: geoJSON(data, {
            pane: 'airspace',
            style: feature =>
              feature ? this.poaffStyle(feature as Feature<Geometry, PoaffProperties>) : {},
            onEachFeature: (feature, layer) =>
              this.bindPoaffPopup(feature as Feature<Geometry, PoaffProperties>, layer)
          })
        };
      } catch {
        lastFailure = 'network';
      }
    }

    return { layer: null, failure: lastFailure };
  }

  poaffFailureMessage(failure: AirspaceLoadFailure | undefined): string {
    switch (failure) {
      case 'not_found':
        return this.i18n.t('map.failNotFound');
      case 'network':
        return this.i18n.t('map.failNetwork');
      case 'parse':
        return this.i18n.t('map.failParse');
      default:
        return this.i18n.t('map.failGeneric');
    }
  }

  private poaffStyle(feature: Feature<Geometry, PoaffProperties>): PathOptions {
    const p = feature.properties ?? {};
    return {
      color: p.stroke ?? '#c026d3',
      weight: p['stroke-width'] ?? 1.5,
      opacity: p['stroke-opacity'] ?? 0.85,
      fillColor: p.fill ?? '#f0abfc',
      fillOpacity: Math.min((p['fill-opacity'] ?? 0.45) * 0.55, 0.45)
    };
  }

  private bindPoaffPopup(
    feature: Feature<Geometry, PoaffProperties>,
    layer: Layer
  ): void {
    const p = feature.properties ?? {};
    const name = p.nameV ?? p.id ?? 'Zone';
    const vertical = [p.lower, p.upper].filter(Boolean).join(' → ');
    layer.bindPopup(
      `<div class="gc-airspace-popup"><strong>${this.escapeHtml(name)}</strong>` +
        (p.class ? `<p>Type : ${this.escapeHtml(p.class)}</p>` : '') +
        (vertical ? `<p>${this.escapeHtml(vertical)}</p>` : '') +
        (p.desc ? `<p class="gc-airspace-popup__desc">${this.escapeHtml(p.desc)}</p>` : '') +
        `</div>`
    );
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
