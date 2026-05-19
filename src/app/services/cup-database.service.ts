import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CupApplyMeta, CupDatabaseState } from '../models/cup-database.model';
import { Waypoint } from '../models/waypoint.model';
import { CircuitLeg } from '../models/circuit.model';
import {
  TaskExportOptions,
  DEFAULT_TASK_EXPORT_RADIUS_M
} from '../models/task-declaration.model';
import { CupParserService } from './cup-parser.service';
import { CupWriterService } from './cup-writer.service';
import { CupTaskWriterService } from './cup-task-writer.service';
import { TaskDeclarationResolver } from './task-declaration.resolver';
import { decodeCupFileBytes } from '../utils/cup-text-encoding.util';
import { cupUrlRejectionMessage, isAllowedCupFetchUrl } from '../utils/cup-url.util';
import { readMigratedLocalStorage } from '../utils/local-storage-migrate.util';

const STORAGE_KEY = 'gc_cup_database';
const LEGACY_STORAGE_KEYS = ['vav_cup_database'];
const LEGACY_WAYPOINTS_KEY = 'vav_waypoints';
const RECENT_URLS_KEY = 'gc_cup_recent_urls';
const LEGACY_RECENT_URLS_KEYS = ['vav_cup_recent_urls'];
const MAX_RECENT_URLS = 8;
const DEFAULT_HEADER =
  'name,code,country,lat,lon,elev,style,rwdir,rwlen,rwwidth,freq,desc,userdata,pics';

/** CUP livré avec l’app (URL relative, même origine — pas de CORS). */
export const DEFAULT_EMBEDDED_CUP_URL = '/assets/cup/default.cup';

@Injectable({
  providedIn: 'root'
})
export class CupDatabaseService {
  private cupParser = inject(CupParserService);
  private cupWriter = inject(CupWriterService);
  private cupTaskWriter = inject(CupTaskWriterService);
  private taskResolver = inject(TaskDeclarationResolver);

  private sourceUrl = signal<string | null>(null);
  private sourceLabel = signal<string>('Aucune base');
  private loadedAt = signal<string | null>(null);
  private cupHeaderLine = signal<string>(DEFAULT_HEADER);
  waypoints = signal<Waypoint[]>([]);

  readonly meta = computed(() => ({
    sourceUrl: this.sourceUrl(),
    sourceLabel: this.sourceLabel(),
    loadedAt: this.loadedAt(),
    waypointCount: this.waypoints().length
  }));

  constructor() {
    this.loadFromStorage();
  }

  getSourceUrl(): string | null {
    return this.sourceUrl();
  }

  getSourceLabel(): string {
    return this.sourceLabel();
  }

  getCupHeaderLine(): string {
    return this.cupHeaderLine();
  }

  isFromUrl(url: string): boolean {
    const current = this.sourceUrl();
    if (!current || !url) return false;
    return this.normalizeUrl(current) === this.normalizeUrl(url);
  }

  getRecentUrls(): string[] {
    try {
      const raw = readMigratedLocalStorage(RECENT_URLS_KEY, LEGACY_RECENT_URLS_KEYS);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as string[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async bootstrapFromQueryParam(router: Router): Promise<void> {
    const tree = router.parseUrl(router.url);
    const cupParam = tree.queryParams['cup'];

    if (cupParam?.trim()) {
      const url = cupParam.trim();
      if (!this.isFromUrl(url)) {
        try {
          await this.fetchAndApply(url);
        } catch {
          /* UI : import manuel ou autre URL */
        }
      }
      return;
    }

    // Aucun ?cup= : charger le CUP embarqué si la base locale est encore vide
    if (this.waypoints().length > 0) return;
    if (this.isFromUrl(DEFAULT_EMBEDDED_CUP_URL)) return;

    try {
      await this.fetchAndApply(DEFAULT_EMBEDDED_CUP_URL, 'Base par défaut');
    } catch {
      /* Fichier absent ou invalide — l’utilisateur peut importer */
    }
  }

  async fetchAndApply(url: string, label?: string): Promise<number> {
    if (!isAllowedCupFetchUrl(url)) {
      throw new Error(cupUrlRejectionMessage(url));
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Impossible de charger le CUP (HTTP ${response.status})`);
    }
    const content = decodeCupFileBytes(await response.arrayBuffer());
    const resolvedLabel = label ?? this.labelFromUrl(url);
    const count = this.applyCupContent(content, {
      sourceUrl: url,
      sourceLabel: resolvedLabel
    });
    this.rememberRecentUrl(url);
    return count;
  }

  applyCupContent(content: string, meta: CupApplyMeta): number {
    const headerLine = this.cupParser.extractHeaderLine(content);
    const parsed = this.cupParser
      .parseCupFile(content)
      .map(wp => ({ ...wp, ...this.normalizeWaypointStrings(wp) }));
    this.sourceUrl.set(meta.sourceUrl);
    this.sourceLabel.set(meta.sourceLabel);
    this.loadedAt.set(new Date().toISOString());
    this.cupHeaderLine.set(headerLine);
    this.waypoints.set(parsed);
    this.persist();
    if (meta.sourceUrl) {
      this.rememberRecentUrl(meta.sourceUrl);
    }
    return parsed.length;
  }

  applyCupFile(content: string, filename: string): number {
    return this.applyCupContent(content, {
      sourceUrl: null,
      sourceLabel: filename || 'Import fichier'
    });
  }

  exportCup(): string {
    return this.cupWriter.generateCupFile(this.cupHeaderLine(), this.waypoints());
  }

  exportCupWithTask(
    legs: CircuitLeg[],
    taskName: string,
    options?: Partial<TaskExportOptions>
  ): string {
    const body = this.exportCup();
    if (legs.length === 0) {
      return body;
    }
    const wpMap = new Map(this.waypoints().map(w => [w.id, w]));
    const namesById = new Map(
      [...wpMap.entries()].map(([id, w]) => [id, w.name] as const)
    );
    const declaration = this.taskResolver.resolve(legs, wpMap, taskName, options);
    const defaultRadiusM = options?.defaultRadiusM ?? DEFAULT_TASK_EXPORT_RADIUS_M;
    return this.cupTaskWriter.appendTaskSection(
      body,
      legs,
      namesById,
      declaration,
      defaultRadiusM,
      options?.regulation
    );
  }

  addWaypoint(waypoint: Omit<Waypoint, 'id'>): Waypoint {
    const newWaypoint: Waypoint = {
      ...waypoint,
      ...this.normalizeWaypointStrings(waypoint),
      id: this.generateId(),
      cupFields: waypoint.cupFields ?? { style: this.defaultStyleForType(waypoint.type) }
    };
    this.waypoints.update(current => [...current, newWaypoint]);
    this.persist();
    return newWaypoint;
  }

  updateWaypoint(id: string, updates: Partial<Waypoint>): void {
    this.waypoints.update(current =>
      current.map(wp => {
        if (wp.id !== id) return wp;
        const merged = { ...wp, ...updates, ...this.normalizeWaypointStrings(updates) };
        if (updates.type && !updates.cupFields) {
          merged.cupFields = {
            ...(wp.cupFields ?? {}),
            style: this.defaultStyleForType(updates.type)
          };
        }
        return merged;
      })
    );
    this.persist();
  }

  deleteWaypoint(id: string): void {
    this.waypoints.update(current => current.filter(wp => wp.id !== id));
    this.persist();
  }

  getWaypoint(id: string): Waypoint | undefined {
    return this.waypoints().find(wp => wp.id === id);
  }

  replaceWaypoints(list: Waypoint[]): void {
    this.waypoints.set(list.map(wp => ({ ...wp, ...this.normalizeWaypointStrings(wp) })));
    this.persist();
  }

  clearWaypoints(): void {
    this.waypoints.set([]);
    this.sourceUrl.set(null);
    this.sourceLabel.set('Aucune base');
    this.loadedAt.set(null);
    this.cupHeaderLine.set(DEFAULT_HEADER);
    this.persist();
  }

  private loadFromStorage(): void {
    const raw = readMigratedLocalStorage(STORAGE_KEY, LEGACY_STORAGE_KEYS);
    if (raw) {
      try {
        const data = JSON.parse(raw) as CupDatabaseState;
        this.applyState(data);
        return;
      } catch {
        /* migration */
      }
    }
    this.migrateLegacyWaypoints();
  }

  private migrateLegacyWaypoints(): void {
    const legacy = localStorage.getItem(LEGACY_WAYPOINTS_KEY);
    if (!legacy) return;
    try {
      const wps = JSON.parse(legacy) as Waypoint[];
      if (!Array.isArray(wps) || wps.length === 0) return;
      this.applyState({
        sourceUrl: null,
        sourceLabel: 'Import existant',
        loadedAt: new Date().toISOString(),
        cupHeaderLine: DEFAULT_HEADER,
        waypoints: wps
      });
      localStorage.removeItem(LEGACY_WAYPOINTS_KEY);
    } catch {
      /* ignore */
    }
  }

  private applyState(data: CupDatabaseState): void {
    this.sourceUrl.set(data.sourceUrl ?? null);
    this.sourceLabel.set(data.sourceLabel ?? 'Base locale');
    this.loadedAt.set(data.loadedAt ?? null);
    this.cupHeaderLine.set(data.cupHeaderLine?.trim() || DEFAULT_HEADER);
    this.waypoints.set(
      (data.waypoints ?? []).map(wp => ({ ...wp, ...this.normalizeWaypointStrings(wp) }))
    );
  }

  private persist(): void {
    const state: CupDatabaseState = {
      sourceUrl: this.sourceUrl(),
      sourceLabel: this.sourceLabel(),
      loadedAt: this.loadedAt() ?? new Date().toISOString(),
      cupHeaderLine: this.cupHeaderLine(),
      waypoints: this.waypoints()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  private rememberRecentUrl(url: string): void {
    const normalized = this.normalizeUrl(url);
    const recent = this.getRecentUrls().filter(u => this.normalizeUrl(u) !== normalized);
    recent.unshift(url);
    localStorage.setItem(
      RECENT_URLS_KEY,
      JSON.stringify(recent.slice(0, MAX_RECENT_URLS))
    );
  }

  private normalizeUrl(url: string): string {
    try {
      const u = new URL(url);
      return u.href.replace(/\/$/, '');
    } catch {
      return url.trim().replace(/\/$/, '');
    }
  }

  private labelFromUrl(url: string): string {
    try {
      const u = url.startsWith('http://') || url.startsWith('https://')
        ? new URL(url)
        : new URL(url, 'https://placeholder.local');
      const parts = u.pathname.split('/').filter(Boolean);
      const file = parts[parts.length - 1] ?? 'CUP';
      return decodeURIComponent(file.replace(/\.cup$/i, ''));
    } catch {
      return 'CUP';
    }
  }

  private defaultStyleForType(type: Waypoint['type']): string {
    switch (type) {
      case 'airfield':
        return '5';
      case 'landable':
        return '3';
      default:
        return '1';
    }
  }

  private normalizeWaypointStrings(p: Partial<Waypoint>): Partial<Waypoint> {
    const o: Partial<Waypoint> = {};
    if (typeof p.name === 'string') o.name = p.name.normalize('NFC');
    if (typeof p.code === 'string') o.code = p.code.normalize('NFC');
    if (typeof p.country === 'string') o.country = p.country.normalize('NFC');
    if (typeof p.description === 'string') o.description = p.description.normalize('NFC');
    return o;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}
