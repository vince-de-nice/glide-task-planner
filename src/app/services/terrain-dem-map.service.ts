import { Injectable, OnDestroy } from '@angular/core';
import { Map as MaplibreMap } from 'maplibre-gl';
import {
  buildDemOnlyMapStyle,
  MAP_SOURCE
} from '../components/map-view/map-style.constants';

/** Zoom DEM imposé sur tout le circuit (tuiles Terrarium 512 px). */
export const DEM_SAMPLE_ZOOM = 15;

/** Cache tuiles DEM généreux (nombreuses tuiles z15 sur circuits longs). */
const DEM_MAP_MAX_TILE_CACHE_SIZE_BYTES = 128 * 1024 * 1024;
const DEM_MAP_MAX_TILE_CACHE_ZOOM_LEVELS = 12;
const DEM_MAP_IDLE_TIMEOUT_MS = 25_000;
const DEM_MAP_VIEWPORT_PX = 1024;
const DEM_MAP_FIT_PADDING_PX = 80;
const ELEVATION_CACHE_DECIMALS = 6;
/** Marge pour rester dans le viewport à z15 (évite les bords sans tuile). */
const CHUNK_VIEWPORT_FILL_RATIO = 0.82;

export interface DemSegmentBounds {
  from: [number, number];
  to: [number, number];
}

/**
 * Carte MapLibre hors écran pour `queryTerrainElevation` à zoom {@link DEM_SAMPLE_ZOOM}.
 * Les branches longues sont découpées en fenêtres successives (impossible de cadrer
 * 50 km en z15 dans un viewport 1024 px).
 */
@Injectable({ providedIn: 'root' })
export class TerrainDemMapService implements OnDestroy {
  private map: MaplibreMap | null = null;
  private container: HTMLDivElement | null = null;
  private initPromise: Promise<MaplibreMap> | null = null;
  private readonly elevationCache = new Map<string, number>();
  private readonly loadedSegmentKeys = new Set<string>();
  private segmentLoadPromise: Promise<void> | null = null;
  private segmentLoadKey: string | null = null;

  ngOnDestroy(): void {
    this.destroy();
  }

  destroy(): void {
    this.segmentLoadPromise = null;
    this.segmentLoadKey = null;
    this.loadedSegmentKeys.clear();
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
    this.loadedSegmentKeys.clear();
    this.segmentLoadKey = null;
  }

  /** Centre la carte sur un sous-segment et charge les tuiles à {@link DEM_SAMPLE_ZOOM}. */
  async ensureChunkCoverage(chunk: DemSegmentBounds): Promise<void> {
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

  /**
   * Charge toutes les fenêtres z15 le long du segment (sans interroger les altitudes).
   */
  async ensureSegmentCoverage(segment: DemSegmentBounds): Promise<void> {
    const key = segmentCoverageCacheKey(segment);
    if (this.loadedSegmentKeys.has(key) && !this.segmentLoadPromise) {
      return;
    }
    if (this.segmentLoadKey === key && this.segmentLoadPromise) {
      return this.segmentLoadPromise;
    }

    this.segmentLoadPromise = this.loadSegmentAtZoom15(segment, key).finally(() => {
      this.segmentLoadPromise = null;
    });
    return this.segmentLoadPromise;
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

  private async loadSegmentAtZoom15(
    segment: DemSegmentBounds,
    key: string
  ): Promise<void> {
    const midLat = (segment.from[1] + segment.to[1]) / 2;
    const chunkMaxKm = demChunkMaxSpanKm(
      midLat,
      DEM_SAMPLE_ZOOM,
      DEM_MAP_VIEWPORT_PX,
      DEM_MAP_FIT_PADDING_PX
    );
    const chunks = splitSegmentIntoChunks(segment, chunkMaxKm);

    for (const chunk of chunks) {
      await this.ensureChunkCoverage(chunk);
    }

    this.loadedSegmentKeys.add(key);
    this.segmentLoadKey = key;
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

/**
 * Portée max. (km) d'un segment visible dans le viewport à un zoom donné (grand cercle).
 */
export function demChunkMaxSpanKm(
  latitude: number,
  zoom: number = DEM_SAMPLE_ZOOM,
  viewportPx: number = DEM_MAP_VIEWPORT_PX,
  paddingPx: number = DEM_MAP_FIT_PADDING_PX
): number {
  const effectivePx = Math.max(256, viewportPx - 2 * paddingPx);
  const metersPerPixel =
    (156543.03392 * Math.cos(toRad(latitude))) / Math.pow(2, zoom);
  return (effectivePx * metersPerPixel * CHUNK_VIEWPORT_FILL_RATIO) / 1000;
}

/** Découpe un segment en sous-segments ≤ maxChunkKm (grand cercle). */
export function splitSegmentIntoChunks(
  segment: DemSegmentBounds,
  maxChunkKm: number
): DemSegmentBounds[] {
  const totalKm = haversineKm(segment.from, segment.to);
  if (totalKm <= maxChunkKm || maxChunkKm <= 0) {
    return [segment];
  }

  const chunkCount = Math.ceil(totalKm / maxChunkKm);
  const chunks: DemSegmentBounds[] = [];
  for (let i = 0; i < chunkCount; i++) {
    const t0 = i / chunkCount;
    const t1 = (i + 1) / chunkCount;
    chunks.push({
      from: interpolateGreatCircle(segment.from, segment.to, t0),
      to: interpolateGreatCircle(segment.from, segment.to, t1)
    });
  }
  return chunks;
}

function segmentCoverageCacheKey(segment: DemSegmentBounds): string {
  return `${segment.from[0].toFixed(5)},${segment.from[1].toFixed(5)}-${segment.to[0].toFixed(5)},${segment.to[1].toFixed(5)}@z${DEM_SAMPLE_ZOOM}`;
}

function elevationCacheKey(longitude: number, latitude: number): string {
  return `${longitude.toFixed(ELEVATION_CACHE_DECIMALS)},${latitude.toFixed(ELEVATION_CACHE_DECIMALS)}`;
}

function interpolateGreatCircle(
  from: [number, number],
  to: [number, number],
  t: number
): [number, number] {
  const [lon1, lat1] = from.map(toRad) as [number, number];
  const [lon2, lat2] = to.map(toRad) as [number, number];

  const x1 = Math.cos(lat1) * Math.cos(lon1);
  const y1 = Math.cos(lat1) * Math.sin(lon1);
  const z1 = Math.sin(lat1);
  const x2 = Math.cos(lat2) * Math.cos(lon2);
  const y2 = Math.cos(lat2) * Math.sin(lon2);
  const z2 = Math.sin(lat2);

  const dot = clamp(x1 * x2 + y1 * y2 + z1 * z2, -1, 1);
  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega);

  let xi: number;
  let yi: number;
  let zi: number;
  if (sinOmega < 1e-9) {
    xi = x1 + (x2 - x1) * t;
    yi = y1 + (y2 - y1) * t;
    zi = z1 + (z2 - z1) * t;
  } else {
    const a = Math.sin((1 - t) * omega) / sinOmega;
    const b = Math.sin(t * omega) / sinOmega;
    xi = a * x1 + b * x2;
    yi = a * y1 + b * y2;
    zi = a * z1 + b * z2;
  }
  const lat = Math.atan2(zi, Math.sqrt(xi * xi + yi * yi));
  const lon = Math.atan2(yi, xi);
  return [toDeg(lon), toDeg(lat)];
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinDLon * sinDLon;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
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
