import { Injectable, inject } from '@angular/core';
import { TranslateService } from '../i18n/translate.service';
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
  source: AirspaceSource;
  label: string;
  /** Tuiles raster OpenAIP (TMS). */
  rasterTileUrl?: string;
  /** GeoJSON POAFF pour sources MapLibre. */
  geojson?: FeatureCollection;
}

export type AirspaceLoadFailure =
  | 'network'
  | 'not_found'
  | 'parse'
  | 'unknown';

export interface PoaffProperties {
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

export interface PoaffPaintProps {
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  fill: string;
  fillOpacity: number;
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
        source: 'openaip',
        label: 'OpenAIP',
        rasterTileUrl: `${OPENAIP_TILE_URL}?apiKey=${encodeURIComponent(this.openAipApiKey)}`
      };
    }

    const region = POAFF_AIRSPACE_REGIONS.find(r => r.id === regionId);
    if (!region) return null;

    const loaded = await this.loadPoaffGeoJson(region);
    if (!loaded.geojson) return null;

    return {
      source: 'poaff',
      label: `POAFF — ${region.label}`,
      geojson: loaded.geojson
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
    if (loaded.geojson) {
      return {
        result: {
          source: 'poaff',
          label: `POAFF — ${region.label}`,
          geojson: loaded.geojson
        }
      };
    }
    return { result: null, failure: loaded.failure ?? 'unknown' };
  }

  poaffPaint(feature: Feature<Geometry, PoaffProperties>): PoaffPaintProps {
    const p = feature.properties ?? {};
    return {
      stroke: p.stroke ?? '#c026d3',
      strokeWidth: p['stroke-width'] ?? 1.5,
      strokeOpacity: p['stroke-opacity'] ?? 0.85,
      fill: p.fill ?? '#f0abfc',
      fillOpacity: Math.min((p['fill-opacity'] ?? 0.45) * 0.55, 0.45)
    };
  }

  buildPoaffPopupHtml(feature: Feature<Geometry, PoaffProperties>): string {
    const p = feature.properties ?? {};
    const name = p.nameV ?? p.id ?? 'Zone';
    const vertical = [p.lower, p.upper].filter(Boolean).join(' → ');
    return (
      `<div class="gc-airspace-popup"><strong>${this.escapeHtml(name)}</strong>` +
      (p.class ? `<p>Type : ${this.escapeHtml(p.class)}</p>` : '') +
      (vertical ? `<p>${this.escapeHtml(vertical)}</p>` : '') +
      (p.desc ? `<p class="gc-airspace-popup__desc">${this.escapeHtml(p.desc)}</p>` : '') +
      `</div>`
    );
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

  private async loadPoaffGeoJson(
    region: PoaffRegion
  ): Promise<{ geojson: FeatureCollection | null; failure?: AirspaceLoadFailure }> {
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
        return { geojson: data };
      } catch {
        lastFailure = 'network';
      }
    }

    return { geojson: null, failure: lastFailure };
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
