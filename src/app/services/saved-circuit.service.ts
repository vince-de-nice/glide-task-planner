import { Injectable, computed, inject, signal } from '@angular/core';
import { DEFAULT_FLARM_PROFILE, FlarmProfile } from '../models/flarm-profile.model';
import { CircuitLeg } from '../models/circuit.model';
import { SavedCircuit, SavedCircuitExport, WaypointSnapshot } from '../models/saved-circuit.model';
import { Waypoint } from '../models/waypoint.model';
import { TaskStateService } from './task-state.service';
import { WaypointService } from './waypoint.service';

const STORAGE_KEY = 'vav_saved_circuits';
const LEGACY_KEY = 'vav_circuits';

@Injectable({
  providedIn: 'root'
})
export class SavedCircuitService {
  private waypointService = inject(WaypointService);
  private taskState = inject(TaskStateService);

  circuits = signal<SavedCircuit[]>([]);
  activeCircuitId = signal<string | null>(null);

  circuitCount = computed(() => this.circuits().length);

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as SavedCircuit[];
        this.circuits.set(parsed.map(c => this.normalize(c)));
        return;
      } catch {
        /* fall through to migration */
      }
    }
    this.migrateLegacyCircuits();
  }

  private migrateLegacyCircuits(): void {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return;
    try {
      const items = JSON.parse(legacy) as unknown[];
      const migrated = items
        .map(item => this.migrateLegacyItem(item))
        .filter((c): c is SavedCircuit => c !== null);
      if (migrated.length > 0) {
        this.circuits.set(migrated);
        this.persist();
      }
    } catch {
      /* ignore */
    }
  }

  private migrateLegacyItem(raw: unknown): SavedCircuit | null {
    const c = raw as Record<string, unknown>;
    const waypointIds = Array.isArray(c['waypointIds'])
      ? (c['waypointIds'] as string[])
      : Array.isArray(c['waypoints'])
        ? (c['waypoints'] as Waypoint[]).map(wp => wp.id)
        : [];

    const snapshots: WaypointSnapshot[] = waypointIds
      .map(id => this.waypointService.getWaypoint(id))
      .filter((wp): wp is Waypoint => wp !== undefined)
      .map(wp => this.waypointToSnapshot(wp));

    if (snapshots.length === 0) return null;

    const now = new Date().toISOString();
    return {
      id: String(c['id'] ?? this.generateId()),
      label: String(c['name'] ?? c['taskName'] ?? 'Circuit'),
      taskName: String(c['taskName'] ?? c['name'] ?? 'Circuit'),
      profile: { ...DEFAULT_FLARM_PROFILE },
      waypoints: snapshots,
      createdAt: String(c['createdAt'] ?? now),
      updatedAt: String(c['updatedAt'] ?? now)
    };
  }

  private normalize(c: SavedCircuit): SavedCircuit {
    return {
      ...c,
      profile: {
        ...DEFAULT_FLARM_PROFILE,
        ...c.profile,
        logInterval: clampLogInterval(c.profile?.logInterval)
      },
      waypoints: c.waypoints ?? []
    };
  }

  saveCircuit(input: {
    label: string;
    taskName: string;
    profile: FlarmProfile;
    circuitLegs: CircuitLeg[];
    databaseId?: string | null;
    notes?: string;
    updateId?: string;
  }): SavedCircuit {
    const snapshots = input.circuitLegs
      .map(leg => {
        const wp = this.waypointService.getWaypoint(leg.waypointId);
        if (!wp) return null;
        return this.waypointToSnapshot(wp, leg.role);
      })
      .filter((snap): snap is WaypointSnapshot => snap !== null);

    if (snapshots.length < 2) {
      throw new Error('Au moins 2 points sont requis pour enregistrer un circuit.');
    }

    const now = new Date().toISOString();
    const label = input.label.trim() || input.taskName.trim() || 'Circuit';

    if (input.updateId) {
      const updateId = input.updateId;
      const existing = this.circuits().find(c => c.id === updateId);
      if (!existing) throw new Error('Circuit introuvable');

      const updated: SavedCircuit = {
        ...existing,
        label,
        taskName: input.taskName.trim() || label,
        profile: { ...input.profile },
        waypoints: snapshots,
        databaseId: input.databaseId ?? existing.databaseId,
        notes: input.notes?.trim() || existing.notes,
        updatedAt: now
      };

      this.circuits.update(list => list.map(c => (c.id === updateId ? updated : c)));
      this.activeCircuitId.set(updated.id);
      this.persist();
      return updated;
    }

    const circuit: SavedCircuit = {
      id: this.generateId(),
      label,
      taskName: input.taskName.trim() || label,
      profile: { ...input.profile },
      waypoints: snapshots,
      databaseId: input.databaseId ?? null,
      notes: input.notes?.trim(),
      createdAt: now,
      updatedAt: now
    };

    this.circuits.update(list => [circuit, ...list]);
    this.activeCircuitId.set(circuit.id);
    this.persist();
    return circuit;
  }

  /**
   * Charge un circuit : restaure profil FLARM et reconstruit la tâche
   * (crée les waypoints manquants dans la base locale).
   */
  applyCircuit(circuitId: string): {
    circuitLegs: CircuitLeg[];
    taskName: string;
    profile: FlarmProfile;
  } | null {
    const circuit = this.circuits().find(c => c.id === circuitId);
    if (!circuit) return null;

    const resolved = circuit.waypoints.map(snap => ({
      snap,
      waypointId: this.resolveSnapshot(snap).id
    }));
    const inferred = this.taskState.inferLegsFromWaypointIds(
      resolved.map(r => r.waypointId)
    );
    const circuitLegs: CircuitLeg[] = resolved.map((row, index) => ({
      waypointId: row.waypointId,
      role: row.snap.role ?? inferred[index]?.role ?? 'turnpoint'
    }));
    this.activeCircuitId.set(circuitId);
    return {
      circuitLegs,
      taskName: circuit.taskName,
      profile: { ...circuit.profile }
    };
  }

  deleteCircuit(id: string): void {
    this.circuits.update(list => list.filter(c => c.id !== id));
    if (this.activeCircuitId() === id) {
      this.activeCircuitId.set(null);
    }
    this.persist();
  }

  renameCircuit(id: string, label: string): void {
    const trimmed = label.trim();
    if (!trimmed) return;
    this.circuits.update(list =>
      list.map(c =>
        c.id === id ? { ...c, label: trimmed, updatedAt: new Date().toISOString() } : c
      )
    );
    this.persist();
  }

  duplicateCircuit(id: string): SavedCircuit | null {
    const source = this.circuits().find(c => c.id === id);
    if (!source) return null;
    const now = new Date().toISOString();
    const copy: SavedCircuit = {
      ...source,
      id: this.generateId(),
      label: `${source.label} (copie)`,
      profile: { ...source.profile },
      waypoints: source.waypoints.map(wp => ({ ...wp })),
      createdAt: now,
      updatedAt: now
    };
    this.circuits.update(list => [copy, ...list]);
    this.activeCircuitId.set(copy.id);
    this.persist();
    return copy;
  }

  getCircuit(id: string): SavedCircuit | undefined {
    return this.circuits().find(c => c.id === id);
  }

  exportAll(): string {
    const payload: SavedCircuitExport = {
      version: 1,
      exportedAt: new Date().toISOString(),
      circuits: this.circuits()
    };
    return JSON.stringify(payload, null, 2);
  }

  importFromJson(json: string, merge: boolean): number {
    const data = JSON.parse(json) as SavedCircuitExport | SavedCircuit[];
    const incoming = Array.isArray(data)
      ? data
      : Array.isArray(data.circuits)
        ? data.circuits
        : [];

    const normalized = incoming.map(c => this.normalize(c as SavedCircuit));
    if (merge) {
      const existingIds = new Set(this.circuits().map(c => c.id));
      const toAdd = normalized.map(c =>
        existingIds.has(c.id) ? { ...c, id: this.generateId() } : c
      );
      this.circuits.update(list => [...toAdd, ...list]);
    } else {
      this.circuits.set(normalized);
    }
    this.persist();
    return normalized.length;
  }

  downloadExport(): void {
    const blob = new Blob([this.exportAll()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vav-circuits-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private resolveSnapshot(snap: WaypointSnapshot): Waypoint {
    if (snap.sourceId) {
      const byId = this.waypointService.getWaypoint(snap.sourceId);
      if (byId && this.coordsMatch(byId, snap)) {
        return byId;
      }
    }

    const existing = this.waypointService.waypoints().find(
      wp =>
        this.coordsMatch(wp, snap) ||
        (snap.code && wp.code === snap.code) ||
        wp.name.toLowerCase() === snap.name.toLowerCase()
    );
    if (existing) return existing;

    return this.waypointService.addWaypoint({
      name: snap.name,
      code: snap.code,
      latitude: snap.latitude,
      longitude: snap.longitude,
      elevation: snap.elevation,
      type: snap.type
    });
  }

  private coordsMatch(a: { latitude: number; longitude: number }, b: WaypointSnapshot): boolean {
    return (
      Math.abs(a.latitude - b.latitude) < 0.0002 &&
      Math.abs(a.longitude - b.longitude) < 0.0002
    );
  }

  private waypointToSnapshot(wp: Waypoint, role?: CircuitLeg['role']): WaypointSnapshot {
    return {
      sourceId: wp.id,
      name: wp.name,
      code: wp.code,
      latitude: wp.latitude,
      longitude: wp.longitude,
      elevation: wp.elevation,
      type: wp.type,
      role
    };
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.circuits()));
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

function clampLogInterval(value: unknown): number {
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n)) return DEFAULT_FLARM_PROFILE.logInterval;
  return Math.min(8, Math.max(1, Math.round(n)));
}
