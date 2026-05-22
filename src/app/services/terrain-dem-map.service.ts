import { Injectable, OnDestroy } from '@angular/core';
import { Map as MaplibreMap } from 'maplibre-gl';
import {
  buildDemOnlyMapStyle,
  MAP_SOURCE
} from '../components/map-view/map-style.constants';
import {
  DEM_SAMPLE_ZOOM,
  demChunkMaxSpanKm,
  interpolateGreatCircle,
  splitSegmentIntoChunks,
  type DemSegmentBounds
} from '../utils/terrain-dem-chunk.util';

export { DEM_SAMPLE_ZOOM, type DemSegmentBounds } from '../utils/terrain-dem-chunk.util';
export { demChunkMaxSpanKm, splitSegmentIntoChunks } from '../utils/terrain-dem-chunk.util';

const DEM_MAP_MAX_TILE_CACHE_SIZE_BYTES = 128 * 1024 * 1024;
const DEM_MAP_MAX_TILE_CACHE_ZOOM_LEVELS = 12;
const DEM_MAP_IDLE_TIMEOUT_MS = 25_000;
const DEM_MAP_VIEWPORT_PX = 1024;
const DEM_MAP_FIT_PADDING_PX = 80;
const ELEVATION_CACHE_DECIMALS = 6;

/**
 * Une seule carte MapLibre hors écran (singleton applicatif) pour le DEM Mapterhorn.
 * Elle se déplace (jumpTo) fenêtre par fenêtre à z15 le long des branches ;
 * la carte visible du profil de sécurité reste indépendante.
 */
@Injectable({ providedIn: 'root' })
export class TerrainDemMapService implements OnDestroy {
  private map: MaplibreMap | null = null;
  private container: HTMLDivElement | null = null;
  private initPromise: Promise<MaplibreMap> | null = null;
  private readonly elevationCache = new Map<string, number>();
  /** Sérialise les déplacements : une seule carte, un scroll à la fois. */
  private panQueue: Promise<void> = Promise.resolve();

  ngOnDestroy(): void {
    this.destroy();
  }

  destroy(): void {
    this.panQueue = Promise.resolve();
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
   * Parcourt un segment en fenêtres z15 : scroll de la carte offscreen, puis callback.
   */
  async forEachChunk(
    segment: DemSegmentBounds,
    onChunk: (chunkIndex: number, chunkCount: number) => void | Promise<void>
  ): Promise<void> {
    const map = await this.ensureMap();
    const midLat = (segment.from[1] + segment.to[1]) / 2;
    const viewportPx = map.getCanvas().clientWidth || DEM_MAP_VIEWPORT_PX;
    const chunkMaxKm = demChunkMaxSpanKm(
      midLat,
      DEM_SAMPLE_ZOOM,
      viewportPx,
      DEM_MAP_FIT_PADDING_PX
    );
    const chunks = splitSegmentIntoChunks(segment, chunkMaxKm);

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci];
      await this.enqueuePan(async () => {
        await this.scrollMapToChunk(chunk);
        await onChunk(ci, chunks.length);
      });
    }
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

  private enqueuePan(task: () => Promise<void>): Promise<void> {
    const run = this.panQueue.then(task);
    this.panQueue = run.catch(() => undefined);
    return run;
  }

  /** Centre la carte offscreen sur un sous-segment à z15 et attend les tuiles. */
  private async scrollMapToChunk(chunk: DemSegmentBounds): Promise<void> {
    const map = await this.ensureMap();
    const center = interpolateGreatCircle(chunk.from, chunk.to, 0.5);
    map.jumpTo({
      center,
      zoom: DEM_SAMPLE_ZOOM,
      bearing: 0,
      pitch: 0
    });
    await waitForMapIdle(map, DEM_MAP_IDLE_TIMEOUT_MS);
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
      const px = DEM_MAP_VIEWPORT_PX;
      this.container.style.cssText =
        `position:fixed;left:-9999px;top:0;width:${px}px;height:${px}px;opacity:0;pointer-events:none;overflow:hidden`;
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
        map.resize();
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

function elevationCacheKey(longitude: number, latitude: number): string {
  return `${longitude.toFixed(ELEVATION_CACHE_DECIMALS)},${latitude.toFixed(ELEVATION_CACHE_DECIMALS)}`;
}

function waitForMapIdle(map: MaplibreMap, timeoutMs: number): Promise<void> {
  return new Promise(resolve => {
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
