import { Injectable, computed, signal } from '@angular/core';
import { defaultTaskName } from './flarm-config.service';

const STORAGE_KEY = 'vav_task_state';

interface PersistedTaskState {
  selectedWaypointIds: string[];
  taskName: string;
  activeDatabaseId: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class TaskStateService {
  selectedWaypointIds = signal<string[]>([]);
  taskName = signal<string>(defaultTaskName());
  activeDatabaseId = signal<string | null>(null);

  selectedCount = computed(() => this.selectedWaypointIds().length);

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as PersistedTaskState;
      this.selectedWaypointIds.set(data.selectedWaypointIds ?? []);
      this.taskName.set(data.taskName ?? defaultTaskName());
      this.activeDatabaseId.set(data.activeDatabaseId ?? null);
    } catch {
      /* ignore corrupt state */
    }
  }

  private saveToStorage(): void {
    const data: PersistedTaskState = {
      selectedWaypointIds: this.selectedWaypointIds(),
      taskName: this.taskName(),
      activeDatabaseId: this.activeDatabaseId()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  setTaskName(name: string): void {
    this.taskName.set(name);
    this.saveToStorage();
  }

  setActiveDatabaseId(id: string | null): void {
    this.activeDatabaseId.set(id);
    this.saveToStorage();
  }

  /** Nombre d'occurrences de ce waypoint dans la tâche (doublons inclus). */
  getOccurrenceCount(id: string): number {
    return this.selectedWaypointIds().filter(wid => wid === id).length;
  }

  /** Positions 1-based dans le circuit (ex. [1, 4] si le point est parcouru deux fois). */
  getCircuitIndices(id: string): number[] {
    const indices: number[] = [];
    this.selectedWaypointIds().forEach((wid, index) => {
      if (wid === id) indices.push(index + 1);
    });
    return indices;
  }

  /** Libellés décollage / atterrissage pour un aérodrome en tête ou en queue de circuit. */
  getAirfieldRoleLabels(waypointId: string): string[] {
    const ids = this.selectedWaypointIds();
    if (ids.length === 0) return [];

    const labels: string[] = [];
    if (ids[0] === waypointId) labels.push('Décollage');
    if (ids[ids.length - 1] === waypointId) labels.push('Atterrissage');
    return labels;
  }

  /** Ajoute une occurrence du waypoint en fin de tâche. */
  addWaypoint(id: string): void {
    this.selectedWaypointIds.update(ids => [...ids, id]);
    this.saveToStorage();
  }

  /** Index 0-based de la dernière occurrence de ce waypoint dans le circuit. */
  getLastOccurrenceIndex(waypointId: string): number {
    const ids = this.selectedWaypointIds();
    for (let i = ids.length - 1; i >= 0; i--) {
      if (ids[i] === waypointId) return i;
    }
    return -1;
  }

  /** Retire la dernière occurrence de ce waypoint dans le circuit. */
  removeLastOccurrence(waypointId: string): void {
    const index = this.getLastOccurrenceIndex(waypointId);
    if (index >= 0) this.removeWaypointAt(index);
  }

  /** Retire toutes les occurrences de ce waypoint du circuit. */
  removeAllOccurrences(waypointId: string): void {
    const ids = this.selectedWaypointIds().filter(id => id !== waypointId);
    if (ids.length === this.selectedWaypointIds().length) return;
    this.selectedWaypointIds.set(ids);
    this.saveToStorage();
  }

  /** Retire une seule occurrence à l'index donné. */
  removeWaypointAt(index: number): void {
    const ids = [...this.selectedWaypointIds()];
    if (index < 0 || index >= ids.length) return;
    ids.splice(index, 1);
    this.selectedWaypointIds.set(ids);
    this.saveToStorage();
  }

  moveWaypoint(index: number, direction: 'up' | 'down'): void {
    const ids = [...this.selectedWaypointIds()];
    if (direction === 'up' && index > 0) {
      [ids[index], ids[index - 1]] = [ids[index - 1], ids[index]];
    } else if (direction === 'down' && index < ids.length - 1) {
      [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    } else {
      return;
    }
    this.selectedWaypointIds.set(ids);
    this.saveToStorage();
  }

  clearSelection(): void {
    this.selectedWaypointIds.set([]);
    this.saveToStorage();
  }

  loadTask(waypointIds: string[], name: string): void {
    this.selectedWaypointIds.set([...waypointIds]);
    this.taskName.set(name);
    this.saveToStorage();
  }

  resetTaskNameToToday(): void {
    this.setTaskName(defaultTaskName());
  }
}
