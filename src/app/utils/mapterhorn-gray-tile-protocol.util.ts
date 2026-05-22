import maplibregl from 'maplibre-gl';
import {
  loadTerrariumTileWithFallback,
  terrariumElevationFromRgb
} from './terrain-dem-tile.util';

const TILE_SIZE = 512;

export const MAPTERHORN_GRAY_TILE_PROTOCOL = 'mapterhorn-gray';

/** Modèle de tuiles pour source raster MapLibre (`addProtocol`). */
export const MAPTERHORN_GRAY_TILE_URL_TEMPLATE = `${MAPTERHORN_GRAY_TILE_PROTOCOL}://{z}/{x}/{y}`;

let protocolRegistered = false;

/** Enregistre le protocole une fois (carte principale + profil sécurité). */
export function registerMapterhornGrayTileProtocol(): void {
  if (protocolRegistered) return;
  protocolRegistered = true;

  maplibregl.addProtocol(MAPTERHORN_GRAY_TILE_PROTOCOL, async params => {
    const path = params.url.replace(`${MAPTERHORN_GRAY_TILE_PROTOCOL}://`, '');
    const [zStr, xStr, yStr] = path.split('/').filter(Boolean);
    const z = Number(zStr);
    const x = Number(xStr);
    const y = Number(yStr);
    if (!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`Invalid ${MAPTERHORN_GRAY_TILE_PROTOCOL} tile URL`);
    }

    const loaded = await loadTerrariumTileWithFallback(z, x, y);
    const png = loaded
      ? await imageDataToGrayscalePng(loaded.imageData)
      : await solidGrayTilePng(TILE_SIZE, 48);
    return { data: png };
  });
}

/** Convertit une tuile Terrarium en niveaux de gris (contraste par tuile). */
export function imageDataToGrayscaleRgba(source: ImageData): ImageData {
  const { width, height, data } = source;
  const out = new ImageData(width, height);
  const elevs: number[] = [];
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < data.length; i += 4) {
    const e = terrariumElevationFromRgb(data[i], data[i + 1], data[i + 2]);
    elevs.push(e);
    if (e < min) min = e;
    if (e > max) max = e;
  }

  const span = Math.max(1, max - min);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const gray = Math.round(((elevs[p] - min) / span) * 255);
    out.data[i] = gray;
    out.data[i + 1] = gray;
    out.data[i + 2] = gray;
    out.data[i + 3] = 255;
  }
  return out;
}

async function imageDataToGrayscalePng(imageData: ImageData): Promise<ArrayBuffer> {
  const gray = imageDataToGrayscaleRgba(imageData);
  return imageDataToPng(gray);
}

async function solidGrayTilePng(size: number, gray: number): Promise<ArrayBuffer> {
  const data = new ImageData(size, size);
  for (let i = 0; i < data.data.length; i += 4) {
    data.data[i] = gray;
    data.data[i + 1] = gray;
    data.data[i + 2] = gray;
    data.data[i + 3] = 255;
  }
  return imageDataToPng(data);
}

function imageDataToPng(imageData: ImageData): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      reject(new Error('Canvas 2D unavailable'));
      return;
    }
    ctx.putImageData(imageData, 0, 0);
    canvas.toBlob(
      blob => {
        if (!blob) {
          reject(new Error('PNG encode failed'));
          return;
        }
        void blob.arrayBuffer().then(resolve).catch(reject);
      },
      'image/png',
      1
    );
  });
}
