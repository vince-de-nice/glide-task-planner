import { Injectable } from '@angular/core';
import {
  CupIntegratedManifest,
  CupSourceEntry,
  CupSourcesConfig
} from '../models/cup-sources.model';

@Injectable({
  providedIn: 'root'
})
export class CupSourcesConfigService {
  private cache: CupSourcesConfig | null = null;

  async loadConfig(): Promise<CupSourcesConfig> {
    if (this.cache) return this.cache;

    const [baseRes, integratedRes] = await Promise.all([
      fetch('/config/cup-sources.json'),
      fetch('/config/cup-integrated.json')
    ]);

    if (!baseRes.ok) {
      throw new Error('Impossible de charger la configuration des sources CUP');
    }

    const base = (await baseRes.json()) as { disclaimer?: string };
    const integrated = integratedRes.ok
      ? ((await integratedRes.json()) as CupIntegratedManifest)
      : { sources: [], defaultUrl: null, defaultLabel: null };

    this.cache = {
      disclaimer: base.disclaimer ?? '',
      sources: integrated.sources ?? [],
      defaultUrl: integrated.defaultUrl ?? integrated.sources?.[0]?.url ?? null,
      defaultLabel:
        integrated.defaultLabel ?? integrated.sources?.[0]?.label ?? null
    };
    return this.cache;
  }

  /** Sources connues + URLs récentes (dédupliquées, récentes en tête). */
  mergeWithRecents(
    config: CupSourcesConfig,
    recentUrls: string[]
  ): CupSourceEntry[] {
    const byUrl = new Map<string, CupSourceEntry>();

    for (const url of recentUrls) {
      if (!url?.trim()) continue;
      const normalized = url.trim();
      if (!byUrl.has(normalized)) {
        byUrl.set(normalized, {
          id: `recent-${normalized}`,
          label: `Récent : ${this.shortUrlLabel(normalized)}`,
          url: normalized
        });
      }
    }

    for (const source of config.sources) {
      byUrl.set(source.url.trim(), source);
    }

    return Array.from(byUrl.values());
  }

  private shortUrlLabel(url: string): string {
    try {
      const parts = new URL(url, 'https://placeholder.local').pathname
        .split('/')
        .filter(Boolean);
      const file = parts[parts.length - 1] ?? url;
      return decodeURIComponent(file);
    } catch {
      return url.slice(0, 40);
    }
  }
}
