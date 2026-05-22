import { clamp, haversineKm, interpolateGreatCircle, toRad } from './geo.util';

export { haversineKm, interpolateGreatCircle } from './geo.util';

/** Zoom DEM imposé sur tout le circuit (tuiles Terrarium 512 px). */
export const DEM_SAMPLE_ZOOM = 15;

export interface DemSegmentBounds {
  from: [number, number];
  to: [number, number];
}

const CHUNK_VIEWPORT_FILL_RATIO = 0.82;

/**
 * Portée max. (km) visible dans le viewport à un zoom donné (grand cercle).
 */
export function demChunkMaxSpanKm(
  latitude: number,
  zoom: number = DEM_SAMPLE_ZOOM,
  viewportPx: number,
  paddingPx: number
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

