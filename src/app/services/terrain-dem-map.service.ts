import { Injectable, OnDestroy } from '@angular/core';
import { Map as MaplibreMap } from 'maplibre-gl';
import {
  buildDemOnlyMapStyle,
  MAP_SOURCE
} from '../components/map-view/map-style.constants';

/** Cache tuiles DEM généreux (carte dédiée, hors écran). */
const DEM_MAP_MAX_TILE_CACHE_SIZE_BYTES = 80 * 1024 * 1024;
const DEM_MAP_MAX_TILE_CACHE_ZOOM_LEVELS = 8;
const DEM_MAP_IDLE_TIMEOUT_MS = 12_000;
/** Précision du cache point (≈ 1 m). */
const ELEVATION_CACHE_DECIMALS = 5;

export interface DemSegmentBounds {
  from: [number, number];
  to: [number, number];
}

/**
 * Carte MapLibre hors écran, réservée au chargement du DEM Mapterhorn et aux requêtes
 * `queryTerrainElevation`. Indépendante de la carte affichée sur l'écran profil de sécurité.
 */
@Injectable({ providedIn: 'root' })
export class TerrainDemMapService implements OnDestroy {
  private map: MaplibreMap | null = null;
  private container: HTMLDivElement | null = null;
  private initPromise: Promise<MaplibreMap> | null = null;
  private readonly elevationCache = new Map<string, number>();
  private coverageKey: string | null = null;
  private coveragePromise: Promise<void> | null = null;

  ngOnDestroy(): void {
    this.destroy();
  }

  destroy(): void {
    this.coveragePromise = null;
    this.coverageKey = null;
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.container?.remove();
    this.container = null;
    this.initPromise = null;
  }

  clearElevationCache(): void {
    this.elevationCache.clear();
  }

  /**
   * Centre la carte DEM sur l'union des segments (circuit ou branche) et attend le chargement des tuiles.
   */
  ensureCoverage(segments: DemSegmentBounds[]): Promise<void> {
    if (segments.length === 0) {
      return Promise.resolve();
    }

    const key = coverageCacheKey(segments);
    if (this.coverageKey === key && !this.coveragePromise) {
      return Promise.resolve();
    }
    if (this.coverageKey === key && this.coveragePromise) {
      return this.coveragePromise;
    }

    this.coveragePromise = this.fitAndWaitForTiles(segments, key).finally(() => {
      this.coveragePromise = null;
    });
    return this.coveragePromise;
  }

  queryElevation(longitude: number, latitude: number): number | null {
    const map = this.map;
    if (!map || !map.loaded()) return null;

    const cacheKey = elevationCacheKey(longitude, latitude);
    const cached = this.elevationCache.get(cacheKey);
    if (cached !== undefined) return cached;

    try {
      const raw = map.queryTerrainElevation([longitude, latitude]);
      if (raw == null || !Number.isFinite(raw)) return null;
      this.elevationCache.set(cacheKey, raw);
      return raw;
    } catch {
      return null;
    }
  }

  private async fitAndWaitForTiles(
    segments: DemSegmentBounds[],
    key: string
  ): Promise<void> {
    const map = await this.ensureMap();
    const bounds = unionSegmentBounds(segments);
    if (!bounds) return;

    try {
      const cam = map.cameraForBounds(bounds, {
        padding: 48,
        maxZoom: 12,
        bearing: 0,
        pitch: 0
      });
      if (cam) {
        map.jumpTo({
          center: cam.center,
          zoom: cam.zoom,
          bearing: 0,
          pitch: 0
        });
      }
    } catch {
      const [sw, ne] = bounds;
      map.jumpTo({
        center: [(sw[0] + ne[0]) / 2, (sw[1] + ne[1]) / 2],
        zoom: 10,
        bearing: 0,
        pitch: 0
      });
    }

    await waitForMapIdle(map, DEM_MAP_IDLE_TIMEOUT_MS);
    this.coverageKey = key;
  }

  private ensureMap(): Promise<MaplibreMap> {
    if (this.map) {
      return Promise.resolve(this.map);
    }
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise<MaplibreMap>((resolve, reject) => {
      this.container = document.createElement('div');
      this.container.setAttribute('aria-hidden', 'true');
      this.container.style.cssText =
        'position:fixed;left:-9999px;top:0;width:512px;height:512px;opacity:0;pointer-events:none;overflow:hidden';
      document.body.appendChild(this.container);

      const map = new MaplibreMap({
        container: this.container,
        style: buildDemOnlyMapStyle(),
        center: [6.5, 46.5],
        zoom: 8,
        bearing: 0,
        pitch: 0,
        interactive: false,
        attributionControl: false,
        fadeDuration: 0,
        maxTileCacheSize: DEM_MAP_MAX_TILE_CACHE_SIZE_BYTES,
        maxTileCacheZoomLevels: DEM_MAP_MAX_TILE_CACHE_ZOOM_LEVELS,
        refreshExpiredTiles: false
      });

      map.once('load', () => {
        if (!map.getTerrain()) {
          map.setTerrain({ source: MAP_SOURCE.TERRAIN_DEM, exaggeration: 1 });
        }
        this.map = map;
        resolve(map);
      });

      map.once('error', ev => {
        reject(ev.error ?? new Error('DEM map failed to load'));
      });
    });

    return this.initPromise.catch(err => {
      this.initPromise = null;
      throw err;
    });
  }
}

function unionSegmentBounds(
  segments: DemSegmentBounds[]
): [[number, number], [number, number]] | null {
  const lngs: number[] = [];
  const lats: number[] = [];
  for (const s of segments) {
    lngs.push(s.from[0], s.to[0]);
    lats.push(s.from[1], s.to[1]);
  }
  if (lngs.length === 0) return null;
  const pad = 0.04;
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const dLng = Math.max(0.02, (maxLng - minLng) * pad);
  const dLat = Math.max(0.02, (maxLat - minLat) * pad);
  return [
    [minLng - dLng, minLat - dLat],
    [maxLng + dLng, maxLat + dLat]
  ];
}

function coverageCacheKey(segments: DemSegmentBounds[]): string {
  return segments
    .map(
      s =>
        `${s.from[0].toFixed(4)},${s.from[1].toFixed(4)}-${s.to[0].toFixed(4)},${s.to[1].toFixed(4)}`
    )
    .join('|');
}

function elevationCacheKey(longitude: number, latitude: number): string {
  return `${longitude.toFixed(ELEVATION_CACHE_DECIMALS)},${latitude.toFixed(ELEVATION_CACHE_DECIMALS)}`;
}

function waitForMapIdle(map: MaplibreMap, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      map.off('idle', onIdle);
      resolve();
    };

    const onIdle = (): void => {
      if (typeof map.areTilesLoaded === 'function' && !map.areTilesLoaded()) {
        return;
      }
      finish();
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      map.off('idle', onIdle);
      resolve();
    }, timeoutMs);

    map.once('idle', onIdle);
    if (!map.isMoving()) {
      map.triggerRepaint();
    }
  });
}
