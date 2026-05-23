import { Injectable, computed, signal } from '@angular/core';
import type { FeatureCollection, Geometry } from 'geojson';
import {
  DEFAULT_POAFF_REGION_ID,
  POAFF_AIRSPACE_REGIONS
} from '../config/map-airspace.config';
import {
  AIRSPACE_ACTIVE_SOURCE_KEY,
  AIRSPACE_CUSTOM_CATALOG_KEY,
  AIRSPACE_CUSTOM_IDB_NAME,
  AIRSPACE_CUSTOM_IDB_STORE,
  AIRSPACE_INCLUDE_AREA_GEO_KEY,
  isCustomAirspaceSourceId,
  newCustomAirspaceSourceId
} from '../config/airspace-data-source.constants';
import {
  filterAreaGeoFromAirspaceCollection,
  type AirspaceZoneClassTypeProps
} from '../utils/airspace-datasource-filter.util';
import type {
  BuiltinAirspaceSourceMeta,
  CustomAirspaceSourceMeta
} from '../models/airspace-data-source.model';
const TASK_MAP_PREFS_KEY = 'gc-airspace-prefs-task-map';

@Injectable({ providedIn: 'root' })
export class AirspaceDataSourceService {

  readonly builtinSources: readonly BuiltinAirspaceSourceMeta[] =
    POAFF_AIRSPACE_REGIONS.map(r => ({
      id: r.id,
      label: r.label,
      kind: 'poaff' as const
    }));

  readonly customSources = signal<CustomAirspaceSourceMeta[]>([]);
  readonly activeSourceId = signal<string>(DEFAULT_POAFF_REGION_ID);
  /**
   * Inclure les zones POAFF `class` AREA et `type` GEO.
   * Par défaut false : filtrées à la lecture de la source.
   */
  readonly includeAreaGeoZones = signal(readIncludeAreaGeoPref());
  /** Incrémenté à chaque changement de catalogue ou de source active (réactivité carte). */
  readonly revision = signal(0);

  readonly activeLabel = computed(() => this.labelFor(this.activeSourceId()));

  private customDbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    this.customSources.set(this.readCustomCatalog());
    this.activeSourceId.set(this.resolveInitialActiveId());
  }

  isKnownSourceId(sourceId: string): boolean {
    if (isCustomAirspaceSourceId(sourceId)) {
      return this.customSources().some(s => s.id === sourceId);
    }
    return POAFF_AIRSPACE_REGIONS.some(r => r.id === sourceId);
  }

  labelFor(sourceId: string): string {
    const custom = this.customSources().find(s => s.id === sourceId);
    if (custom) return custom.label;
    const builtin = POAFF_AIRSPACE_REGIONS.find(r => r.id === sourceId);
    return builtin?.label ?? sourceId;
  }

  loadLabelFor(sourceId: string): string {
    if (isCustomAirspaceSourceId(sourceId)) {
      return `Import — ${this.labelFor(sourceId)}`;
    }
    const region = POAFF_AIRSPACE_REGIONS.find(r => r.id === sourceId);
    return region ? `POAFF — ${region.label}` : sourceId;
  }

  setIncludeAreaGeoZones(include: boolean): void {
    if (this.includeAreaGeoZones() === include) return;
    this.includeAreaGeoZones.set(include);
    try {
      localStorage.setItem(AIRSPACE_INCLUDE_AREA_GEO_KEY, include ? '1' : '0');
    } catch {
      /* quota / mode privé */
    }
    this.revision.update(n => n + 1);
  }

  /** Filtre datasource (AREA / GEO) si l’option n’est pas activée. */
  applyDatasourceFilter<P extends AirspaceZoneClassTypeProps>(
    collection: FeatureCollection<Geometry, P>
  ): FeatureCollection<Geometry, P> {
    if (this.includeAreaGeoZones()) return collection;
    return filterAreaGeoFromAirspaceCollection(collection);
  }

  async setActiveSource(sourceId: string): Promise<void> {
    if (!this.isKnownSourceId(sourceId)) return;
    if (this.activeSourceId() === sourceId) return;
    this.activeSourceId.set(sourceId);
    localStorage.setItem(AIRSPACE_ACTIVE_SOURCE_KEY, sourceId);
    this.revision.update(n => n + 1);
  }

  async importGeoJsonFile(file: File, label?: string): Promise<string | null> {
    let text: string;
    try {
      text = await file.text();
    } catch {
      return null;
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return null;
    }

    if (!isFeatureCollection(data)) return null;

    const id = newCustomAirspaceSourceId();
    const displayLabel =
      label?.trim() ||
      file.name.replace(/\.(geo)?json$/i, '').trim() ||
      file.name;

    try {
      await this.writeCustomGeoJson(id, data);
    } catch {
      return null;
    }

    const meta: CustomAirspaceSourceMeta = {
      id,
      label: displayLabel,
      importedAt: new Date().toISOString(),
      featureCount: data.features.length
    };

    const nextCatalog = [...this.customSources(), meta];
    this.persistCustomCatalog(nextCatalog);
    this.customSources.set(nextCatalog);
    await this.setActiveSource(id);
    return id;
  }

  async removeCustomSource(sourceId: string): Promise<void> {
    if (!isCustomAirspaceSourceId(sourceId)) return;

    const nextCatalog = this.customSources().filter(s => s.id !== sourceId);
    this.persistCustomCatalog(nextCatalog);
    this.customSources.set(nextCatalog);

    try {
      const db = await this.openCustomDb();
      await idbDelete(db, AIRSPACE_CUSTOM_IDB_STORE, sourceId);
    } catch (err) {
      console.warn('[airspace-data-source] delete custom failed:', err);
    }

    if (this.activeSourceId() === sourceId) {
      await this.setActiveSource(DEFAULT_POAFF_REGION_ID);
    } else {
      this.revision.update(n => n + 1);
    }
  }

  async readCustomGeoJson(
    sourceId: string
  ): Promise<FeatureCollection<Geometry, unknown> | null> {
    if (!isCustomAirspaceSourceId(sourceId)) return null;
    if (typeof indexedDB === 'undefined') return null;
    try {
      const db = await this.openCustomDb();
      return await idbGet<FeatureCollection<Geometry, unknown>>(
        db,
        AIRSPACE_CUSTOM_IDB_STORE,
        sourceId
      );
    } catch (err) {
      console.warn('[airspace-data-source] read custom failed:', err);
      return null;
    }
  }

  private resolveInitialActiveId(): string {
    const stored = localStorage.getItem(AIRSPACE_ACTIVE_SOURCE_KEY);
    if (stored) {
      if (isCustomAirspaceSourceId(stored)) {
        const catalog = this.readCustomCatalog();
        if (catalog.some(s => s.id === stored)) return stored;
      } else if (POAFF_AIRSPACE_REGIONS.some(r => r.id === stored)) {
        return stored;
      }
    }

    try {
      const raw = localStorage.getItem(TASK_MAP_PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { regionId?: string };
        if (
          typeof parsed.regionId === 'string' &&
          POAFF_AIRSPACE_REGIONS.some(r => r.id === parsed.regionId)
        ) {
          localStorage.setItem(AIRSPACE_ACTIVE_SOURCE_KEY, parsed.regionId);
          return parsed.regionId;
        }
      }
    } catch {
      /* ignore */
    }

    return DEFAULT_POAFF_REGION_ID;
  }

  private readCustomCatalog(): CustomAirspaceSourceMeta[] {
    try {
      const raw = localStorage.getItem(AIRSPACE_CUSTOM_CATALOG_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isCustomMeta);
    } catch {
      return [];
    }
  }

  private persistCustomCatalog(catalog: CustomAirspaceSourceMeta[]): void {
    localStorage.setItem(AIRSPACE_CUSTOM_CATALOG_KEY, JSON.stringify(catalog));
  }

  private async writeCustomGeoJson(
    sourceId: string,
    geojson: FeatureCollection<Geometry, unknown>
  ): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      throw new Error('indexedDB unavailable');
    }
    const db = await this.openCustomDb();
    await idbPut(db, AIRSPACE_CUSTOM_IDB_STORE, sourceId, geojson);
  }

  private openCustomDb(): Promise<IDBDatabase> {
    if (!this.customDbPromise) {
      this.customDbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(AIRSPACE_CUSTOM_IDB_NAME, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(AIRSPACE_CUSTOM_IDB_STORE)) {
            db.createObjectStore(AIRSPACE_CUSTOM_IDB_STORE);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(request.error ?? new Error('indexedDB.open failed'));
      });
    }
    return this.customDbPromise;
  }
}

function readIncludeAreaGeoPref(): boolean {
  try {
    return localStorage.getItem(AIRSPACE_INCLUDE_AREA_GEO_KEY) === '1';
  } catch {
    return false;
  }
}

function isFeatureCollection(
  value: unknown
): value is FeatureCollection<Geometry, unknown> {
  if (!value || typeof value !== 'object') return false;
  const v = value as FeatureCollection;
  return v.type === 'FeatureCollection' && Array.isArray(v.features);
}

function isCustomMeta(value: unknown): value is CustomAirspaceSourceMeta {
  if (!value || typeof value !== 'object') return false;
  const v = value as CustomAirspaceSourceMeta;
  return (
    typeof v.id === 'string' &&
    isCustomAirspaceSourceId(v.id) &&
    typeof v.label === 'string' &&
    typeof v.importedAt === 'string' &&
    typeof v.featureCount === 'number'
  );
}

function idbGet<T>(db: IDBDatabase, store: string, key: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(
  db: IDBDatabase,
  store: string,
  key: string,
  value: unknown
): Promise<void> {
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
