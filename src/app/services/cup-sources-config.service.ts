import { Injectable } from '@angular/core';
import { CupSourceEntry, CupSourcesConfig } from '../models/cup-sources.model';

@Injectable({
  providedIn: 'root'
})
export class CupSourcesConfigService {
  private cache: CupSourcesConfig | null = null;

  async loadConfig(): Promise<CupSourcesConfig> {
    if (this.cache) return this.cache;
    const response = await fetch('/config/cup-sources.json');
    if (!response.ok) {
      throw new Error('Impossible de charger la configuration des sources CUP');
    }
    this.cache = (await response.json()) as CupSourcesConfig;
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
      const parts = new URL(url).pathname.split('/').filter(Boolean);
      return decodeURIComponent(parts[parts.length - 1] ?? url);
    } catch {
      return url.slice(0, 40);
    }
  }
}
