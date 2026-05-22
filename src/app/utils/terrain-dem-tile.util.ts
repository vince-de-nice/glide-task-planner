import {
  MAPTERHORN_DEM_TILE_SIZE,
  MAPTERHORN_DEM_TILE_URL
} from './terrain-dem.constants';
import { DEM_SAMPLE_ZOOM } from './terrain-dem-chunk.util';

/** Échantillons à remplir (altitude null = à charger). */
export interface TerrainElevationSample {
  longitude: number;
  latitude: number;
  elevationM: number | null;
  /** Renseigné après chargement : DEM nominal ou repli tuile z−1. */
  demSampleQuality?: 'dem' | 'dem-low';
}

/** Zoom minimal pour le repli tuile (z−1, z−2…). */
export const DEM_MIN_FALLBACK_ZOOM = 8;

const tileImageCache = new Map<string, Promise<ImageData | null>>();
const TILE_FETCH_CONCURRENCY = 8;

export function clearTerrainDemTileCache(): void {
  tileImageCache.clear();
}

export function tileCacheKey(z: number, x: number, y: number): string {
  return `${z}/${x}/${y}`;
}

/** Charge les altitudes manquantes en ne téléchargeant chaque tuile Terrarium qu'une fois. */
export async function fillTerrariumElevations(
  samples: readonly TerrainElevationSample[],
  zoom: number = DEM_SAMPLE_ZOOM
): Promise<void> {
  const pending = samples.filter(s => s.elevationM == null);
  if (pending.length === 0) return;

  const byTile = new Map<string, TerrainElevationSample[]>();
  for (const sample of pending) {
    const { x, y, z } = lngLatToTile(sample.longitude, sample.latitude, zoom);
    const key = tileCacheKey(z, x, y);
    const list = byTile.get(key);
    if (list) {
      list.push(sample);
    } else {
      byTile.set(key, [sample]);
    }
  }

  const groups = [...byTile.entries()];
  await runWithConcurrency(groups, TILE_FETCH_CONCURRENCY, async ([key, pts]) => {
    const [zStr, xStr, yStr] = key.split('/');
    const z = Number(zStr);
    const x = Number(xStr);
    const y = Number(yStr);
    const loaded = await loadTerrariumTileWithFallback(z, x, y);
    if (!loaded) {
      for (const sample of pts) {
        sample.elevationM = null;
        sample.demSampleQuality = undefined;
      }
      return;
    }

    const { imageData, usedZoom } = loaded;
    const quality: 'dem' | 'dem-low' = usedZoom < z ? 'dem-low' : 'dem';
    const coords = tileCoordsAtTargetZoom(x, y, z, usedZoom);
    const bbox = tileBbox(coords.x, coords.y, usedZoom);

    for (const sample of pts) {
      sample.elevationM = elevationFromImageData(
        imageData,
        sample.longitude,
        sample.latitude,
        bbox
      );
      sample.demSampleQuality = quality;
    }
  });
}

/** Coordonnées tuile à `atZoom` couvrant la cellule `x,y` au zoom `targetZoom`. */
export function tileCoordsAtTargetZoom(
  x: number,
  y: number,
  targetZoom: number,
  atZoom: number
): { x: number; y: number } {
  const scale = 2 ** (targetZoom - atZoom);
  return {
    x: Math.floor(x / scale),
    y: Math.floor(y / scale)
  };
}

/** Charge la tuile au zoom demandé, puis z−1, z−2… jusqu’à {@link DEM_MIN_FALLBACK_ZOOM}. */
export async function loadTerrariumTileWithFallback(
  z: number,
  x: number,
  y: number
): Promise<{ imageData: ImageData; usedZoom: number } | null> {
  for (let cz = z; cz >= DEM_MIN_FALLBACK_ZOOM; cz--) {
    const { x: cx, y: cy } = tileCoordsAtTargetZoom(x, y, z, cz);
    const imageData = await loadTerrariumTileImage(cz, cx, cy);
    if (imageData) {
      return { imageData, usedZoom: cz };
    }
  }
  return null;
}

function elevationFromImageData(
  imageData: ImageData,
  longitude: number,
  latitude: number,
  bbox: [number, number, number, number]
): number | null {
  const [px, py] = pixelPosition(longitude, latitude, bbox, MAPTERHORN_DEM_TILE_SIZE);
  const idx = (py * MAPTERHORN_DEM_TILE_SIZE + px) * 4;
  const data = imageData.data;
  if (idx + 2 >= data.length) return null;
  return terrariumElevationFromRgb(data[idx], data[idx + 1], data[idx + 2]);
}

/** Formule Terrarium (identique à @watergis/terrain-rgb). */
export function terrariumElevationFromRgb(r: number, g: number, b: number): number {
  const raw = r * 256 + g + b / 256 - 32768;
  return Math.round(raw);
}

function lngLatToTile(
  longitude: number,
  latitude: number,
  z: number
): { x: number; y: number; z: number } {
  const n = 2 ** z;
  const x = Math.floor(((longitude + 180) / 360) * n);
  const latRad = (latitude * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y, z };
}

function tileBbox(x: number, y: number, z: number): [number, number, number, number] {
  const west = tile2lon(x, z);
  const east = tile2lon(x + 1, z);
  const north = tile2lat(y, z);
  const south = tile2lat(y + 1, z);
  return [west, south, east, north];
}

function tile2lon(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180;
}

function tile2lat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function pixelPosition(
  longitude: number,
  latitude: number,
  bbox: [number, number, number, number],
  tileSize: number
): [number, number] {
  const [west, south, east, north] = bbox;
  const spanX = east - west;
  const spanY = north - south;
  const u = spanX > 0 ? (longitude - west) / spanX : 0;
  const v = spanY > 0 ? (latitude - south) / spanY : 0;
  const px = Math.min(tileSize - 1, Math.max(0, Math.floor(tileSize * u)));
  const py = Math.min(tileSize - 1, Math.max(0, Math.floor(tileSize * (1 - v))));
  return [px, py];
}

/** ImageData Terrarium décodée (partagé profil sécurité + fond carte DEM gris). */
export function loadTerrariumTileImage(
  z: number,
  x: number,
  y: number
): Promise<ImageData | null> {
  const key = tileCacheKey(z, x, y);
  let pending = tileImageCache.get(key);
  if (!pending) {
    pending = fetchTerrariumTileImage(z, x, y).then(data => {
      if (data === null) {
        tileImageCache.delete(key);
      }
      return data;
    });
    tileImageCache.set(key, pending);
  }
  return pending;
}

async function fetchTerrariumTileImage(
  z: number,
  x: number,
  y: number
): Promise<ImageData | null> {
  const url = MAPTERHORN_DEM_TILE_URL.replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return null;
  }

  if (!response.ok) {
    return response.status === 404 ? null : null;
  }

  const blob = await response.blob();
  return decodeImageBlob(blob, MAPTERHORN_DEM_TILE_SIZE);
}

function decodeImageBlob(blob: Blob, tileSize: number): Promise<ImageData | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = tileSize;
        canvas.height = tileSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(image, 0, 0, tileSize, tileSize);
        resolve(ctx.getImageData(0, 0, tileSize, tileSize));
      } catch {
        resolve(null);
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    image.src = url;
  });
}

/** Exécute des tâches async avec un plafond de concurrence (partagé tuiles DEM / branches). */
export async function runTasksWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  let index = 0;
  const runWorker = async (): Promise<void> => {
    while (index < items.length) {
      const i = index++;
      await worker(items[i], i);
    }
  };
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => runWorker()));
}

async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  await runTasksWithConcurrency(items, limit, (item, _i) => worker(item));
}
