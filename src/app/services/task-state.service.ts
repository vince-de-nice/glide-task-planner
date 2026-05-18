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

  /** Ajoute une occurrence du waypoint en fin de tâche. */
  addWaypoint(id: string): void {
    this.selectedWaypointIds.update(ids => [...ids, id]);
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

  /** Duplique l'occurrence à l'index (copie insérée juste après). */
  duplicateWaypointAt(index: number): void {
    const ids = [...this.selectedWaypointIds()];
    if (index < 0 || index >= ids.length) return;
    ids.splice(index + 1, 0, ids[index]);
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
