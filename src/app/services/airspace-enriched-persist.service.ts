import { Injectable } from '@angular/core';
import type { FeatureCollection, Geometry } from 'geojson';
import { POAFF_AIRSPACE_REGIONS } from '../config/map-airspace.config';
import {
  AIRSPACE_ENRICH_CACHE_SCHEMA_VERSION,
  AIRSPACE_ENRICH_DEM_ZOOM,
  AIRSPACE_ENRICH_IDB_NAME,
  AIRSPACE_ENRICH_IDB_STORE
} from '../config/airspace-enrich-cache.constants';
import type { AirspaceVolumeProperties } from '../utils/airspace-volume-enrich.util';
import { poaffCollectionFingerprint } from '../utils/airspace-poaff-fingerprint.util';

export interface PersistedAirspaceEnrichedEntry {
  regionId: string;
  sourceAssetFile: string;
  sourceFingerprint: string;
  schemaVersion: number;
  demZoom: number;
  label: string;
  enriched: FeatureCollection<Geometry, AirspaceVolumeProperties>;
  savedAt: number;
}

@Injectable({ providedIn: 'root' })
export class AirspaceEnrichedPersistService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  sourceAssetFile(regionId: string): string | null {
    return POAFF_AIRSPACE_REGIONS.find(r => r.id === regionId)?.assetFile ?? null;
  }

  async read(regionId: string): Promise<PersistedAirspaceEnrichedEntry | null> {
    if (typeof indexedDB === 'undefined') return null;
    try {
      const db = await this.openDb();
      return await idbGet<PersistedAirspaceEnrichedEntry>(
        db,
        AIRSPACE_ENRICH_IDB_STORE,
        regionId
      );
    } catch (err) {
      console.warn('[airspace-enriched-persist] read failed:', err);
      return null;
    }
  }

  matchesCurrentSource(
    entry: PersistedAirspaceEnrichedEntry,
    regionId: string,
    sourceFingerprint: string
  ): boolean {
    const assetFile = this.sourceAssetFile(regionId);
    return (
      entry.regionId === regionId &&
      assetFile != null &&
      entry.sourceAssetFile === assetFile &&
      entry.sourceFingerprint === sourceFingerprint &&
      entry.schemaVersion === AIRSPACE_ENRICH_CACHE_SCHEMA_VERSION &&
      entry.demZoom === AIRSPACE_ENRICH_DEM_ZOOM &&
      entry.enriched?.features != null
    );
  }

  async write(params: {
    regionId: string;
    sourceFingerprint: string;
    label: string;
    enriched: FeatureCollection<Geometry, AirspaceVolumeProperties>;
  }): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    const sourceAssetFile = this.sourceAssetFile(params.regionId);
    if (!sourceAssetFile) return;

    const entry: PersistedAirspaceEnrichedEntry = {
      regionId: params.regionId,
      sourceAssetFile,
      sourceFingerprint: params.sourceFingerprint,
      schemaVersion: AIRSPACE_ENRICH_CACHE_SCHEMA_VERSION,
      demZoom: AIRSPACE_ENRICH_DEM_ZOOM,
      label: params.label,
      enriched: params.enriched,
      savedAt: Date.now()
    };

    try {
      const db = await this.openDb();
      await idbPut(db, AIRSPACE_ENRICH_IDB_STORE, params.regionId, entry);
    } catch (err) {
      console.warn('[airspace-enriched-persist] write failed:', err);
    }
  }

  async delete(regionId: string): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    try {
      const db = await this.openDb();
      await idbDelete(db, AIRSPACE_ENRICH_IDB_STORE, regionId);
    } catch (err) {
      console.warn('[airspace-enriched-persist] delete failed:', err);
    }
  }

  fingerprintFromGeoJson(
    geojson: FeatureCollection<Geometry, unknown>
  ): string {
    return poaffCollectionFingerprint(
      geojson as FeatureCollection<Geometry, import('../services/airspace-layer.service').PoaffProperties>
    );
  }

  private openDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openAirspaceEnrichedDb();
    }
    return this.dbPromise;
  }
}

function openAirspaceEnrichedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(AIRSPACE_ENRICH_IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AIRSPACE_ENRICH_IDB_STORE)) {
        db.createObjectStore(AIRSPACE_ENRICH_IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexedDB.open failed'));
  });
}

function idbGet<T>(db: IDBDatabase, store: string, key: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, store: string, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db: IDBDatabase, store: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    req.onerror = () => reject(req.error);
  });
}
