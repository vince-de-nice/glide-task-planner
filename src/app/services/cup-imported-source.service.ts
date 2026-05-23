import { Injectable, inject, signal } from '@angular/core';
import {
  CUP_IMPORTED_CATALOG_KEY,
  CUP_IMPORTED_IDB_NAME,
  CUP_IMPORTED_IDB_STORE,
  cupImportSourceKey,
  parseCupImportId
} from '../config/cup-import.constants';
import type { CupImportedSourceMeta } from '../models/cup-imported-source.model';
import { decodeCupFileBytes } from '../utils/cup-text-encoding.util';
import { CupDatabaseService } from './cup-database.service';
import { CupParserService } from './cup-parser.service';

@Injectable({ providedIn: 'root' })
export class CupImportedSourceService {
  private readonly cupDatabase = inject(CupDatabaseService);
  private readonly cupParser = inject(CupParserService);

  readonly imports = signal<CupImportedSourceMeta[]>([]);

  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    this.imports.set(this.readCatalog());
  }

  isActiveImport(importId: string): boolean {
    return parseCupImportId(this.cupDatabase.getSourceUrl()) === importId;
  }

  async importFile(file: File): Promise<string | null> {
    let content: string;
    try {
      content = decodeCupFileBytes(await file.arrayBuffer());
    } catch {
      return null;
    }

    const waypointCount = this.cupParser.parseCupFile(content).length;
    if (waypointCount === 0) return null;

    const id = crypto.randomUUID();
    const label =
      file.name.replace(/\.cup$/i, '').trim() || file.name || 'Import';

    try {
      await this.writeFile(id, content);
    } catch {
      return null;
    }

    const meta: CupImportedSourceMeta = {
      id,
      label,
      importedAt: new Date().toISOString(),
      waypointCount
    };
    const next = [...this.imports(), meta];
    this.persistCatalog(next);
    this.imports.set(next);

    this.cupDatabase.applyCupContent(content, {
      sourceUrl: cupImportSourceKey(id),
      sourceLabel: label
    });

    return id;
  }

  async activateImport(importId: string): Promise<number> {
    const content = await this.readFile(importId);
    if (!content) return 0;
    const meta = this.imports().find(m => m.id === importId);
    return this.cupDatabase.applyCupContent(content, {
      sourceUrl: cupImportSourceKey(importId),
      sourceLabel: meta?.label ?? 'Import'
    });
  }

  async removeImport(importId: string): Promise<void> {
    const next = this.imports().filter(m => m.id !== importId);
    this.persistCatalog(next);
    this.imports.set(next);

    try {
      const db = await this.openDb();
      await idbDelete(db, CUP_IMPORTED_IDB_STORE, importId);
    } catch (err) {
      console.warn('[cup-imported-source] delete failed:', err);
    }
  }

  private readCatalog(): CupImportedSourceMeta[] {
    try {
      const raw = localStorage.getItem(CUP_IMPORTED_CATALOG_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isMeta);
    } catch {
      return [];
    }
  }

  private persistCatalog(catalog: CupImportedSourceMeta[]): void {
    localStorage.setItem(CUP_IMPORTED_CATALOG_KEY, JSON.stringify(catalog));
  }

  private async readFile(importId: string): Promise<string | null> {
    if (typeof indexedDB === 'undefined') return null;
    try {
      const db = await this.openDb();
      return await idbGet<string>(db, CUP_IMPORTED_IDB_STORE, importId);
    } catch (err) {
      console.warn('[cup-imported-source] read failed:', err);
      return null;
    }
  }

  private async writeFile(importId: string, content: string): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      throw new Error('indexedDB unavailable');
    }
    const db = await this.openDb();
    await idbPut(db, CUP_IMPORTED_IDB_STORE, importId, content);
  }

  private openDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(CUP_IMPORTED_IDB_NAME, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(CUP_IMPORTED_IDB_STORE)) {
            db.createObjectStore(CUP_IMPORTED_IDB_STORE);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(request.error ?? new Error('indexedDB.open failed'));
      });
    }
    return this.dbPromise;
  }
}

function isMeta(value: unknown): value is CupImportedSourceMeta {
  if (!value || typeof value !== 'object') return false;
  const v = value as CupImportedSourceMeta;
  return (
    typeof v.id === 'string' &&
    typeof v.label === 'string' &&
    typeof v.importedAt === 'string' &&
    typeof v.waypointCount === 'number'
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
