import { DEM_SAMPLE_ZOOM } from '../utils/terrain-dem-chunk.util';

/** Incrémenter si le format d’enrichissement Terrarium change (recalcul obligatoire). */
export const AIRSPACE_ENRICH_CACHE_SCHEMA_VERSION = 2;

export const AIRSPACE_ENRICH_DEM_ZOOM = DEM_SAMPLE_ZOOM;

export const AIRSPACE_ENRICH_IDB_NAME = 'gc-airspace-enriched';
export const AIRSPACE_ENRICH_IDB_STORE = 'regions';
