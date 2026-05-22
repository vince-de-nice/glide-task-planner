import { Injectable, OnDestroy } from '@angular/core';
import {
  DEM_SAMPLE_ZOOM,
  demChunkMaxSpanKm,
  splitSegmentIntoChunks,
  type DemSegmentBounds
} from '../utils/terrain-dem-chunk.util';
import {
  clearTerrainDemTileCache,
  fillTerrariumElevations,
  type TerrainElevationSample
} from '../utils/terrain-dem-tile.util';

export { DEM_SAMPLE_ZOOM, type DemSegmentBounds } from '../utils/terrain-dem-chunk.util';
export { demChunkMaxSpanKm, splitSegmentIntoChunks } from '../utils/terrain-dem-chunk.util';

/** Viewport virtuel pour découper les branches (progression UI, parallélisme tuiles). */
const DEM_CHUNK_VIEWPORT_PX = 1024;
const DEM_CHUNK_PADDING_PX = 80;
const ELEVATION_CACHE_DECIMALS = 6;

/**
 * Échantillonnage DEM Mapterhorn via fetch direct de tuiles Terrarium
 * ({@link fillTerrariumElevations}, cache tuile + formule @watergis/terrain-rgb).
 */
@Injectable({ providedIn: 'root' })
export class TerrainDemMapService implements OnDestroy {
  private readonly elevationCache = new Map<string, number>();

  ngOnDestroy(): void {
    this.clearElevationCache();
  }

  clearElevationCache(): void {
    this.elevationCache.clear();
    clearTerrainDemTileCache();
  }

  /**
   * Découpe le segment en fenêtres (km) et appelle le callback pour chaque fenêtre.
   * Le chargement des tuiles se fait via {@link fillSampleElevations}.
   */
  async forEachChunk(
    segment: DemSegmentBounds,
    onChunk: (chunkIndex: number, chunkCount: number) => void | Promise<void>
  ): Promise<void> {
    const midLat = (segment.from[1] + segment.to[1]) / 2;
    const chunkMaxKm = demChunkMaxSpanKm(
      midLat,
      DEM_SAMPLE_ZOOM,
      DEM_CHUNK_VIEWPORT_PX,
      DEM_CHUNK_PADDING_PX
    );
    const chunks = splitSegmentIntoChunks(segment, chunkMaxKm);

    for (let ci = 0; ci < chunks.length; ci++) {
      await onChunk(ci, chunks.length);
    }
  }

  /**
   * Télécharge les tuiles Terrarium nécessaires et remplit `elevationM` sur les échantillons.
   */
  async fillSampleElevations(samples: readonly TerrainElevationSample[]): Promise<void> {
    await fillTerrariumElevations(samples);
    for (const sample of samples) {
      if (sample.elevationM == null) continue;
      this.elevationCache.set(
        elevationCacheKey(sample.longitude, sample.latitude),
        sample.elevationM
      );
    }
  }

  /** Lit le cache point (rempli par {@link fillSampleElevations}). */
  queryElevation(longitude: number, latitude: number): number | null {
    const cached = this.elevationCache.get(elevationCacheKey(longitude, latitude));
    return cached !== undefined ? cached : null;
  }
}

function elevationCacheKey(longitude: number, latitude: number): string {
  return `${longitude.toFixed(ELEVATION_CACHE_DECIMALS)},${latitude.toFixed(ELEVATION_CACHE_DECIMALS)}`;
}
